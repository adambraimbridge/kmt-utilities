const logger = require('./../../../lib/logger');
const sinon = require('sinon');
const expect = require('chai').expect;
const nock = require('nock');
const httpMocks = require('node-mocks-http');
const { assignActiveLicence } = require('./../../../index');
const { acquisitionCtxClient } = require('@financial-times/kat-client-proxies');
const licenceContext = require('./../fixtures/licenceContext.js');

describe('assignActiveLicence', () => {
	let getContextStub;
	let logMessageStub;
	const logMessages = [];
	const licenceId = '00000000-0000-0000-0000-000000000001';
	let req;

	before(() => {
		logMessageStub = sinon.stub(logger, 'log').callsFake((...params) => {
			logMessages.push(params);
		});
	});

	beforeEach(() => {
		req = {
			params: {
				licenceId
			},
			KATConfig: {
				licenceList :[
					{
						licenceId,
						creationDate: '2015-11-30T14:53:32.795Z',
						status: 'active',
						contractId: 'KAT-test',
						product: 'FT.com Premium'
					}
				]
			},
		};
	});

	afterEach(() => {
		nock.cleanAll();
		getContextStub.restore();

	});

	after(() => {
		nock.cleanAll();

		logMessageStub.restore();

	});

	it('should decorate req.KATConfig.activeLicence with data from acquisition context service ', () => {
		const res = httpMocks.createResponse();
		const nextSpy = sinon.spy();

		nock('https://api.ft.com')
			.get(`/acquisition-contexts/v1?access-licence-id=${licenceId}`)
			.reply(200, () => licenceContext);

		getContextStub = sinon.stub(acquisitionCtxClient, 'getContexts').resolves(licenceContext);

			return assignActiveLicence(req, res, nextSpy)
				.then(() => {
					const activeLicence = req.KATConfig.activeLicence;

					expect(activeLicence).to.be.an('Object');
					expect(activeLicence.signupURI).to.equal(licenceContext.barrierContext.redirectUrl);
					expect(activeLicence.displayName).to.equal(licenceContext.displayName);
					expect(activeLicence.productAbbrv).to.equal('Premium');
				});

	});

	it('should decorate req.KATConfig.activeLicence with null values for displayName and signupURI for 404 response from acquisition context service ', () => {
		const res = httpMocks.createResponse();
		const nextSpy = sinon.spy();
		const licenceId = '00000000-0000-0000-0000-000000000002';

		nock('https://api.ft.com')
			.get(`/acquisition-contexts/v1?access-licence-id=${licenceId}`)
			.reply(404);

			return assignActiveLicence(req, res, nextSpy)
				.then(() => {
					const activeLicence = req.KATConfig.activeLicence;

					expect(activeLicence).to.be.an('Object');
					expect(activeLicence.signupURI).to.equal(null);
					expect(activeLicence.displayName).to.equal(null);
					expect(activeLicence.productAbbrv).to.equal('Premium');
				});

	});

	it('should thow for any other 503', () => {
		const res = httpMocks.createResponse();
		const nextSpy = sinon.spy();
		const licenceId = '00000000-0000-0000-0000-000000000002';

		nock('https://api.ft.com')
			.get(`/acquisition-contexts/v1?access-licence-id=${licenceId}`)
			.reply(503);

			return assignActiveLicence(req, res, nextSpy)
				.catch((err) => {
					expect(nextSpy.calledOnce).to.be.true;
					expect(err).to.be.an.instanceof(Error);
					expect(err.status).to.equal(503);
				});
	});
});
