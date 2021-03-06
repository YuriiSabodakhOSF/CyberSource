'use strict';

var dwsvc = require('dw/svc');
var Logger = require('dw/system/Logger');
var CybersourceConstants = require('~/cartridge/scripts/utils/CybersourceConstants');
var CSServices = require('~/cartridge/scripts/init/SoapServiceInit');
/**
 * This method create the input for the cybersource credit card payment method, validates it and gets response from the service.
 * @param LineItemCtnrObj : dw.order.LineItemCtnr
 * @param IPAddress : Client Ip address
 * @param orderNo : String
 * @param SubscriptionID : String
 * @param payerEnrollResponse : Object
 * @param payerValidationResponse : Object
 * @param ReadFromBasket : boolean
 */

function CCAuthRequest(Basket : dw.order.LineItemCtnr, OrderNo : String, IPAddress : String, SubscriptionID:String,
    payerEnrollResponse : Object, payerValidationResponse : Object, ReadFromBasket : Boolean)
{
    var basket = Basket;
    var orderNo = OrderNo;

    //* *************************************************************************//
    // Check if Basket exists
    //* *************************************************************************//
    if (basket === null) {
        Logger.error('Please provide a Basket!');
        return { error: true };
    }
    var PaymentInstrument = require('dw/order/PaymentInstrument');
    var CardHelper = require('~/cartridge/scripts/helper/CardHelper');
    var CommonHelper = require('~/cartridge/scripts/helper/CommonHelper');
    var libCybersource = require('~/cartridge/scripts/cybersource/libCybersource');
    var CybersourceConstants = require('~/cartridge/scripts/utils/CybersourceConstants');
    var Site = require('dw/system/Site');
    var CsSAType = Site.getCurrent().getCustomPreferenceValue('CsSAType').value;

    var CybersourceHelper = libCybersource.getCybersourceHelper();
    // Objects to set in the Service Request inside facade
    var billTo; var shipTo; var purchaseObject; var
        cardObject;
    var result = CommonHelper.CreateCyberSourceBillToObject(basket, ReadFromBasket);
    billTo = result.billTo;
    result = CommonHelper.CreateCybersourceShipToObject(basket);
    shipTo = result.shipTo;

    result = CardHelper.CreateCybersourcePaymentCardObject('billing', SubscriptionID);
    cardObject = result.card;

    result = CommonHelper.CreateCybersourcePurchaseTotalsObject(basket);
    purchaseObject = result.purchaseTotals;
    result = CommonHelper.CreateCybersourceItemObject(basket);
    var items : dw.util.List = result.items;

    //* *************************************************************************//
    // Set WebReference & Stub
    //* *************************************************************************//
    var csReference = webreferences2.CyberSourceTransaction;

    var serviceRequest = new csReference.RequestMessage();
    //* *************************************************************************//
    // the request object holds the input parameter for the OnDemand Subscription request
    //* *************************************************************************//
    if (!empty(SubscriptionID)) {
        CybersourceHelper.addOnDemandSubscriptionInfo(SubscriptionID, serviceRequest, purchaseObject, orderNo);
    }
    else if (CybersourceHelper.getSubscriptionTokenizationEnabled().equals('YES')) {
        CybersourceHelper.addPaySubscriptionCreateService(serviceRequest, billTo, purchaseObject, cardObject, OrderNo);
    }

    //* *************************************************************************//
    // the request object holds the input parameter for the AUTH request
    //* *************************************************************************//
    CybersourceHelper.addCCAuthRequestInfo(serviceRequest, billTo, shipTo, purchaseObject, cardObject, orderNo, CybersourceHelper.getDigitalFingerprintEnabled(), items);

    // Populate Payer Auth Reply service response attributes
    if (payerValidationResponse) {
        CybersourceHelper.addPayerAuthReplyInfo(serviceRequest, payerValidationResponse.CAVV, payerValidationResponse.UCAFAuthenticationData,
            payerValidationResponse.UCAFCollectionIndicator, payerValidationResponse.ECIRaw, payerValidationResponse.PAVCommerceIndicator,
            payerValidationResponse.PAVXID, payerValidationResponse.ParesStatus, payerValidationResponse.specificationVersion, payerValidationResponse.directoryServerTransactionID, payerValidationResponse.cavvAlgorithm,
            payerValidationResponse.effectiveAuthenticationType, payerValidationResponse.challengeCancelCode, payerValidationResponse.authenticationStatusReason, payerValidationResponse.acsTransactionID, payerValidationResponse.authorizationPayload);
    } else if (payerEnrollResponse) {
        CybersourceHelper.addPayerAuthReplyInfo(
            serviceRequest, payerEnrollResponse.CAVV, payerEnrollResponse.UCAFAuthenticationData,
            payerEnrollResponse.UCAFCollectionIndicator, payerEnrollResponse.ECIRaw, payerEnrollResponse.PACommerceIndicator,
            payerEnrollResponse.PAXID, payerEnrollResponse.ParesStatus, payerEnrollResponse.specificationVersion, payerEnrollResponse.directoryServerTransactionID, null,
            payerEnrollResponse.effectiveAuthenticationType, payerEnrollResponse.challengeCancelCode, payerEnrollResponse.authenticationStatusReason, payerEnrollResponse.acsTransactionID
        );
    }
    /** ***************************** */
    /* DAV-related WebService setup */
    /** ***************************** */

    var enableDAV = CybersourceHelper.getDavEnable();
    var approveDAV = CybersourceHelper.getDavOnAddressVerificationFailure();
    //  lineItemCtnr.paymentInstrument field is deprecated.  Get default payment method.
    var paymentInstrument = null;
    if (!empty(basket.getPaymentInstruments())) {
        paymentInstrument = basket.getPaymentInstruments()[0];
    }
    if (paymentInstrument.paymentMethod !== CybersourceConstants.METHOD_GooglePay) {
        if (enableDAV == 'YES') {
            var ignoreDAVResult = false;
            if (approveDAV == 'APPROVE') {
                ignoreDAVResult = true;
            }
            CybersourceHelper.addDAVRequestInfo(serviceRequest, billTo, shipTo, ignoreDAVResult);
        }
        /* End of DAV WebService setup */

        /* AVS Service setup */
        var ignoreAVSResult = CybersourceHelper.getAvsIgnoreResult();
        var declineAVSFlags = CybersourceHelper.getAvsDeclineFlags();

        CybersourceHelper.addAVSRequestInfo(serviceRequest, ignoreAVSResult, declineAVSFlags);
	 }
    /* End of AVS Service setup */
    CardHelper.writeOutDebugLog(serviceRequest, orderNo);

    //  Provide ability to customize request object with a hook.
    var HookMgr = require('dw/system/HookMgr');
    if (HookMgr.hasHook('app.cybersource.modifyrequest')) {
        var modifiedServiceRequest = HookMgr.callHook('app.cybersource.modifyrequest', 'CCAuth', serviceRequest);
        if (!empty(modifiedServiceRequest)) {
            serviceRequest = modifiedServiceRequest;
        }
    }
    //* *************************************************************************//
    // Execute Request
    //* *************************************************************************//
    var serviceResponse = null;
    try
    {
        var service = CSServices.CyberSourceTransactionService;
        // getting merchant id and key for specific payment method
        var merchantCrdentials = CybersourceHelper.getMerhcantCredentials(CybersourceConstants.METHOD_CREDIT_CARD);
        var requestWrapper = {};
	    serviceRequest.merchantID = merchantCrdentials.merchantID;
	   if (paymentInstrument.paymentMethod === CybersourceConstants.METHOD_GooglePay) {
		    serviceRequest.paymentSolution = '012';
		    var csReference = webreferences2.CyberSourceTransaction;
            var request_encryptedPayment = new csReference.EncryptedPayment();
		     request_encryptedPayment.data = session.privacy.encryptedDataGP;
		     serviceRequest.encryptedPayment = request_encryptedPayment;
	   }

        requestWrapper.request = serviceRequest;

        requestWrapper.merchantCredentials = merchantCrdentials;

        serviceResponse = service.call(requestWrapper);
    }
    catch (e)
    {
        Logger.error('[CardFacade.js] Error in CCAuthRequest ( {0} )', e.message);
        return { error: true, errorMsg: e.message };
    }

    Logger.debug(serviceResponse);

    if (empty(serviceResponse) || serviceResponse.status !== 'OK')
    {
        Logger.error('[CardFacade.js] CCAuthRequest Error : null response');
        return { error: true, errorMsg: 'empty or error in test CCAuthRequest response: ' + serviceResponse };
    }
    serviceResponse = serviceResponse.object;
    CardHelper.protocolResponse(serviceResponse);
    //* *************************************************************************//
    // Process Response
    //* *************************************************************************//
    result = CardHelper.ProcessCardAuthResponse(serviceResponse, shipTo, billTo);
    return { success: true, serviceResponse: result.responseObject };
}

/**
 * DAV request call is made to cybersource and response if send back.
 * @param LineItemCtnrObj : dw.order.LineItemCtnr contains object of basket or order
 * @param bill To : billing address of the order
 * @param ship to : Shipping address of the order
 */

function DAVRequest(Basket : dw.order.LineItemCtnr, billTo : Object, shipTo : Object)
{
    // read pipeline dictionary input parameter
    var basket = Basket;

    if (basket === null) {
        Logger.error('[CardFacade.js DAVRequest] Please provide a Basket');
        return { error: true };
    }

    var billToObject = billTo;
    var shipToObject = shipTo;

    var libCybersource = require('~/cartridge/scripts/cybersource/libCybersource');
    var CybersourceHelper = libCybersource.getCybersourceHelper();

    var csReference = webreferences2.CyberSourceTransaction;
    var serviceRequest = new csReference.RequestMessage();

    CybersourceHelper.addDAVRequestInfo(serviceRequest, billToObject, shipToObject);

    var serviceResponse = null;
    // send request
    try {
        var service = CSServices.CyberSourceTransactionService;
        var merchantCrdentials = CybersourceHelper.getMerhcantCredentials(CybersourceConstants.METHOD_CREDIT_CARD);
        var requestWrapper = {};
	    serviceRequest.merchantID = merchantCrdentials.merchantID;
        requestWrapper.request = serviceRequest;
        requestWrapper.merchantCredentials = merchantCrdentials;
        serviceResponse = service.call(requestWrapper);
    } catch (e) {
        Logger.error('[CardFacade.js] Error in DAV request ( {0} )', e.message);
        return { error: true, errorMsg: e.message };
    }

    if (empty(serviceResponse) || serviceResponse.status !== 'OK') {
        Logger.error('[CardFacade.js] response in DAV response ( {0} )', serviceResponse);
        return { error: true, errorMsg: 'empty or error in DAV response: ' + serviceResponse };
    }
    serviceResponse = serviceResponse.object;
    // set response values in local variables
    var responseObject = {};
    responseObject.RequestID = serviceResponse.requestID;
    responseObject.RequestToken = serviceResponse.requestToken;
    responseObject.ReasonCode = serviceResponse.reasonCode.get();
    responseObject.Decision = serviceResponse.decision;
    responseObject.davReply = (serviceResponse.davReply !== null) ? 'exists' : null;
    if (serviceResponse.davReply !== null) {
        responseObject.DAVReasonCode = serviceResponse.davReply.reasonCode.get();
    }
    return { success: true, serviceResponse: responseObject };
}

/**
 * Payer Auth call is made to cybersource and response if send back.
 * @param LineItemCtnrObj : dw.order.LineItemCtnr contains object of basket or order
 * @param amount : order total
 * @param OrderNo : Order number
 * @param CreditCardForm : details of the card
 */

function PayerAuthEnrollCheck(LineItemCtnrObj : dw.order.LineItemCtnr, Amount : dw.value.Money, OrderNo : String, CreditCardForm)
{
    var lineItemCtnrObj = LineItemCtnrObj;
    var amount = Amount;
    var creditCardForm = CreditCardForm;
    var orderNo : String = OrderNo;

    if ((lineItemCtnrObj === null || creditCardForm === null)) {
        Logger.error('[CardFacade.js] Please provide a Basket and the credit card form element!');
        return { error: true };
    }

    var CardHelper = require('~/cartridge/scripts/helper/CardHelper');
    var libCybersource = require('~/cartridge/scripts/cybersource/libCybersource');
    var CybersourceHelper = libCybersource.getCybersourceHelper();
    var csReference = webreferences2.CyberSourceTransaction;
    var serviceRequest = new csReference.RequestMessage();
    var paymentInstrument = CardHelper.getNonGCPaymemtInstument(lineItemCtnrObj);
    var CommonHelper = require('~/cartridge/scripts/helper/CommonHelper');
    var deviceType = CommonHelper.getDeviceType(request);
    var billTo;
    var result = CommonHelper.CreateCyberSourceBillToObject(lineItemCtnrObj, true);
    billTo = result.billTo;

    CybersourceHelper.addPayerAuthEnrollInfo(serviceRequest, orderNo, creditCardForm, lineItemCtnrObj.billingAddress.countryCode.value, amount, paymentInstrument.getCreditCardToken(), lineItemCtnrObj.billingAddress.phone, deviceType, billTo);

    //  Provide ability to customize request object with a hook.
    var HookMgr = require('dw/system/HookMgr');
    if (HookMgr.hasHook('app.cybersource.modifyrequest')) {
        var modifiedServiceRequest = HookMgr.callHook('app.cybersource.modifyrequest', 'PayerAuthEnroll', serviceRequest);
        if (!empty(modifiedServiceRequest)) {
            serviceRequest = modifiedServiceRequest;
        }
    }

    var serviceResponse = null;
    // send request
    try {
        var service = CSServices.CyberSourceTransactionService;
        var merchantCrdentials = CybersourceHelper.getMerhcantCredentials(CybersourceConstants.METHOD_CREDIT_CARD);
        var requestWrapper = {};
	    serviceRequest.merchantID = merchantCrdentials.merchantID;
        requestWrapper.request = serviceRequest;
        requestWrapper.merchantCredentials = merchantCrdentials;
        serviceResponse = service.call(requestWrapper);
    } catch (e) {
        Logger.error('[CardFacade.js] Error in PayerAuthEnrollCheck request ( {0} )', e.message);
        return { error: true, errorMsg: e.message };
    }
    if (empty(serviceResponse) || serviceResponse.status !== 'OK') {
        Logger.error('[CardFacade.js] response in PayerAuthEnrollCheck response ( {0} )', serviceResponse);
        return { error: true, errorMsg: 'empty or error in PayerAuthEnrollCheck response: ' + serviceResponse };
    }
    serviceResponse = serviceResponse.object;
    // set response values in local variables
    var responseObject = {};
    responseObject.RequestID = serviceResponse.requestID;
    responseObject.RequestToken = serviceResponse.requestToken;
    responseObject.ReasonCode = serviceResponse.reasonCode.get();
    responseObject.Decision = serviceResponse.decision;
    responseObject.payerAuthEnrollReply = (serviceResponse.payerAuthEnrollReply !== null) ? 'exists' : null;
    if (serviceResponse.payerAuthEnrollReply !== null) {
        responseObject.PACommerceIndicator = serviceResponse.payerAuthEnrollReply.commerceIndicator;
        responseObject.UCAFCollectionIndicator = serviceResponse.payerAuthEnrollReply.ucafCollectionIndicator;
        responseObject.ProofXML = serviceResponse.payerAuthEnrollReply.proofXML;
        responseObject.AcsURL = serviceResponse.payerAuthEnrollReply.acsURL;
        responseObject.PAXID = serviceResponse.payerAuthEnrollReply.xid;
        responseObject.PAReq = serviceResponse.payerAuthEnrollReply.paReq;
        responseObject.ProxyPAN = serviceResponse.payerAuthEnrollReply.proxyPAN;
        responseObject.authenticationTransactionID = serviceResponse.payerAuthEnrollReply.authenticationTransactionID;
        responseObject.specificationVersion = serviceResponse.payerAuthEnrollReply.specificationVersion;
        responseObject.directoryServerTransactionID = serviceResponse.payerAuthEnrollReply.directoryServerTransactionID;
        responseObject.CAVV = serviceResponse.payerAuthEnrollReply.cavv;
        responseObject.UCAFAuthenticationData = serviceResponse.payerAuthEnrollReply.ucafAuthenticationData;
        responseObject.veresEnrolled = serviceResponse.payerAuthEnrollReply.veresEnrolled;
        responseObject.networkScore = serviceResponse.payerAuthEnrollReply.networkScore;
        responseObject.effectiveAuthenticationType = serviceResponse.payerAuthEnrollReply.effectiveAuthenticationType;
        responseObject.ParesStatus = serviceResponse.payerAuthEnrollReply.paresStatus;
        responseObject.ECIRaw = serviceResponse.payerAuthEnrollReply.eciRaw;
        responseObject.challengeCancelCode = serviceResponse.payerAuthEnrollReply.challengeCancelCode;
        responseObject.authenticationStatusReason = (!empty(serviceResponse.payerAuthEnrollReply.authenticationStatusReason)) && ((serviceResponse.payerAuthEnrollReply.authenticationStatusReason).toString().length == 1) ? '0' + serviceResponse.payerAuthEnrollReply.authenticationStatusReason : serviceResponse.payerAuthEnrollReply.authenticationStatusReason;
    }

    return { success: true, serviceResponse: responseObject };
}

/**
 * Payer Auth validation call is made to cybersource and response if send back.
 * @param PaRes :
 * @param amount : order total
 * @param OrderNo : Order number
 * @param CreditCardForm : details of the card
 */

function PayerAuthValidation(PaRes : String, Amount : dw.value.Money, OrderNo : String, CreditCardForm : dw.web.FormElement, CreditCardToken: String, processorTransactionId: String, billTo : Object)
{
    var orderNo = OrderNo;
    var amount = Amount;
    var creditCardForm = CreditCardForm;
    var billTo = billTo;
    var signedPaRes = !empty(PaRes) ? dw.util.StringUtils.trim(PaRes) : '';
    signedPaRes = signedPaRes.replace('/[^a-zA-Z0-9/+=]/g', '');
    //* *************************************************************************//
    // Set WebReference & Stub
    //* *************************************************************************//
    var libCybersource = require('~/cartridge/scripts/cybersource/libCybersource');
    var CybersourceHelper = libCybersource.getCybersourceHelper();

    var csReference = webreferences2.CyberSourceTransaction;
    var serviceRequest = new csReference.RequestMessage();

    CybersourceHelper.addPayerAuthValidateInfo(serviceRequest, orderNo, signedPaRes, creditCardForm, amount, CreditCardToken, processorTransactionId, billTo);

    //  Provide ability to customize request object with a hook.
    var HookMgr = require('dw/system/HookMgr');
    if (HookMgr.hasHook('app.cybersource.modifyrequest')) {
        var modifiedServiceRequest = HookMgr.callHook('app.cybersource.modifyrequest', 'PayerAuthValidation', serviceRequest);
        if (!empty(modifiedServiceRequest)) {
            serviceRequest = modifiedServiceRequest;
        }
    }

    var serviceResponse = null;
    // send request
    try {
        var service = CSServices.CyberSourceTransactionService;
        var merchantCrdentials = CybersourceHelper.getMerhcantCredentials(CybersourceConstants.METHOD_CREDIT_CARD);
        var requestWrapper = {};
	    serviceRequest.merchantID = merchantCrdentials.merchantID;
        requestWrapper.request = serviceRequest;
        requestWrapper.merchantCredentials = merchantCrdentials;
        serviceResponse = service.call(requestWrapper);
    } catch (e) {
        Logger.error('[CardFacade.js] Error in PayerAuthValidation request ( {0} )', e.message);
        return { error: true, errorMsg: e.message };
    }

    if (empty(serviceResponse) || serviceResponse.status !== 'OK') {
        Logger.error('[CardFacade.js] response in PayerAuthValidation response ( {0} )', serviceResponse);
        return { error: true, errorMsg: 'empty or error in PayerAuthValidation response: ' + serviceResponse };
    }
    serviceResponse = serviceResponse.object;
    // set response values in local variables
    var responseObject = {};
    responseObject.RequestID = serviceResponse.requestID;
    responseObject.RequestToken = serviceResponse.requestToken;
    responseObject.ReasonCode = serviceResponse.reasonCode.get();
    responseObject.Decision = serviceResponse.decision;
    responseObject.payerAuthValidateReply = (serviceResponse.payerAuthValidateReply !== null) ? 'exists' : null;
    if (serviceResponse.payerAuthValidateReply !== null) {
        responseObject.AuthenticationResult = serviceResponse.payerAuthValidateReply.authenticationResult;
        responseObject.AuthenticationStatusMessage = serviceResponse.payerAuthValidateReply.authenticationStatusMessage;
        responseObject.CAVV = serviceResponse.payerAuthValidateReply.cavv;
        responseObject.UCAFAuthenticationData = serviceResponse.payerAuthValidateReply.ucafAuthenticationData;
        responseObject.UCAFCollectionIndicator = serviceResponse.payerAuthValidateReply.ucafCollectionIndicator;
        responseObject.PAVCommerceIndicator = serviceResponse.payerAuthValidateReply.commerceIndicator;
        responseObject.PAVXID = serviceResponse.payerAuthValidateReply.xid;
        responseObject.ECIRaw = serviceResponse.payerAuthValidateReply.eciRaw;
        responseObject.ParesStatus = serviceResponse.payerAuthValidateReply.paresStatus;
        responseObject.specificationVersion = serviceResponse.payerAuthValidateReply.specificationVersion;
        responseObject.directoryServerTransactionID = serviceResponse.payerAuthValidateReply.directoryServerTransactionID;
        responseObject.cavvAlgorithm = serviceResponse.payerAuthValidateReply.cavvAlgorithm;
        responseObject.effectiveAuthenticationType = serviceResponse.payerAuthValidateReply.effectiveAuthenticationType;
        responseObject.challengeCancelCode = serviceResponse.payerAuthValidateReply.challengeCancelCode;
        responseObject.authenticationStatusReason = (!empty(serviceResponse.payerAuthValidateReply.authenticationStatusReason)) && ((serviceResponse.payerAuthValidateReply.authenticationStatusReason).toString().length == 1) ? '0' + serviceResponse.payerAuthValidateReply.authenticationStatusReason : serviceResponse.payerAuthValidateReply.authenticationStatusReason;
        responseObject.acsTransactionID = serviceResponse.payerAuthValidateReply.acsTransactionID;
        responseObject.authorizationPayload = serviceResponse.payerAuthValidateReply.authorizationPayload;
    }
    return { success: true, serviceResponse: responseObject };
}

/**
 * CCAuthReversalService call is made to cybersource and response if send back.
 * @param requestID :
 * @param amount : order total
 * @param merchantRefCode : cybersource reference number
 * @param paymentType : payment type
 * @currency : currency used
 */
function CCAuthReversalService(requestID, merchantRefCode, paymentType, currency, amount) {
    var libCybersource = require('~/cartridge/scripts/cybersource/libCybersource');
    var CommonHelper = require('~/cartridge/scripts/helper/CommonHelper');
    var CardHelper = require('~/cartridge/scripts/helper/CardHelper');
    var CybersourceHelper = libCybersource.getCybersourceHelper();

    var csReference = webreferences2.CyberSourceTransaction;
    var serviceRequest = new csReference.RequestMessage();
    var purchaseTotals = CardHelper.CreateCyberSourcePurchaseTotalsObject_UserData(currency, amount);
    purchaseTotals = libCybersource.copyPurchaseTotals(purchaseTotals.purchaseTotals);
    	serviceRequest.purchaseTotals = purchaseTotals;

    // Create CCAuthReversal service reference for Credit Card
    CybersourceHelper.addCCAuthReversalServiceInfo(serviceRequest, merchantRefCode, requestID);

    //  Provide ability to customize request object with a hook.
    var HookMgr = require('dw/system/HookMgr');
    if (HookMgr.hasHook('app.cybersource.modifyrequest')) {
        var modifiedServiceRequest = HookMgr.callHook('app.cybersource.modifyrequest', 'AuthReversal', serviceRequest);
        if (!empty(modifiedServiceRequest)) {
            serviceRequest = modifiedServiceRequest;
        }
    }

    // send request
    var serviceResponse = null;
    try {
	        // create request,make service call and store returned response
	        var service = CSServices.CyberSourceTransactionService;
        // getting merchant id and key for specific payment method
        var merchantCrdentials = CybersourceHelper.getMerhcantCredentials(CybersourceConstants.METHOD_CREDIT_CARD);
        var requestWrapper = {};
		    serviceRequest.merchantID = merchantCrdentials.merchantID;
        requestWrapper.request = serviceRequest;
        requestWrapper.merchantCredentials = merchantCrdentials;
        serviceResponse = service.call(requestWrapper);
	  	} catch (e) {
	        Logger.error('[CardFacade.js] Error in CCAuthReversalService: {0}', e.message);
	        return { error: true, errorMsg: e.message };
	    }

	    if (empty(serviceResponse) || serviceResponse.status !== 'OK') {
	        return { error: true, errorMsg: 'empty or error in CC auth reversal service response: ' + serviceResponse };
	    }
	    if (!empty(serviceResponse)) {
        serviceResponse = serviceResponse.object;
	    }

	    return serviceResponse;
}

/**
 * Credit Card Capture call is made to cybersource and response is sent back.
 * @param requestID : Capture request ID, which is same as that of CC Authorize service
 * @param merchantRefCode : Cybersource Merchant Reference Code
 * @param paymentType : Payment Type for Capture
 * @param purchaseTotal : Order total for current request
 * @param currency :
 */

function CCCaptureRequest(requestID: String, merchantRefCode: String, paymentType: String, purchaseTotal : dw.value.Money, currency : String) {
    var libCybersource = require('~/cartridge/scripts/cybersource/libCybersource');
    var CommonHelper = require('~/cartridge/scripts/helper/CommonHelper');
    var CybersourceHelper = libCybersource.getCybersourceHelper();

    var csReference = webreferences2.CyberSourceTransaction;
    var serviceRequest = new csReference.RequestMessage();

    var purchaseObject = CommonHelper.CreateCyberSourcePurchaseTotalsObject_UserData(currency, purchaseTotal);
    purchaseObject = purchaseObject.purchaseTotals;
    serviceRequest.purchaseTotals = libCybersource.copyPurchaseTotals(purchaseObject);

    libCybersource.setClientData(serviceRequest, merchantRefCode);
    CybersourceHelper.ccCaptureService(serviceRequest, merchantRefCode, requestID, paymentType);

    //  Provide ability to customize request object with a hook.
    var HookMgr = require('dw/system/HookMgr');
    if (HookMgr.hasHook('app.cybersource.modifyrequest')) {
        var modifiedServiceRequest = HookMgr.callHook('app.cybersource.modifyrequest', 'Capture', serviceRequest);
        if (!empty(modifiedServiceRequest)) {
            serviceRequest = modifiedServiceRequest;
        }
    }

    var serviceResponse = null;
    // send request
    try {
        var service = CSServices.CyberSourceTransactionService;
        var merchantCrdentials = CybersourceHelper.getMerhcantCredentials(CybersourceConstants.METHOD_CREDIT_CARD);
        var requestWrapper = {};
	    serviceRequest.merchantID = merchantCrdentials.merchantID;
        requestWrapper.request = serviceRequest;
        requestWrapper.merchantCredentials = merchantCrdentials;
        serviceResponse = service.call(requestWrapper);
    } catch (e) {
        Logger.error('[CardFacade.js] Error in CCCaptureRequest request ( {0} )', e.message);
        return { error: true, errorMsg: e.message };
    }

    if (empty(serviceResponse) || serviceResponse.status !== 'OK') {
        Logger.error('[CardFacade.js] response in CCCaptureRequest response ( {0} )', serviceResponse);
        return { error: true, errorMsg: 'empty or error in CCCaptureRequest response: ' + serviceResponse };
    }
    serviceResponse = serviceResponse.object;
    return serviceResponse;
}

/**
 * CC Credit call is made to cybersource and response is sent back.
 * @param requestID : Capture request ID, which is same as that of CC Authorize service
 * @param merchantRefCode : Cybersource Merchant Reference Code
 * @param paymentType : Payment Type for Credit
 * @param purchaseTotal : Order total for current request
 * @param currency :
 */
function CCCreditRequest(requestID: String, merchantRefCode: String, paymentType: String, purchaseTotal : dw.value.Money, currency : String) {
    var libCybersource = require('~/cartridge/scripts/cybersource/libCybersource');
    var CommonHelper = require('~/cartridge/scripts/helper/CommonHelper');
    var CybersourceHelper = libCybersource.getCybersourceHelper();

    var csReference = webreferences2.CyberSourceTransaction;
    var serviceRequest = new csReference.RequestMessage();

    var purchaseObject = CommonHelper.CreateCyberSourcePurchaseTotalsObject_UserData(currency, purchaseTotal);

    purchaseObject = purchaseObject.purchaseTotals;
    serviceRequest.purchaseTotals = libCybersource.copyPurchaseTotals(purchaseObject);

    libCybersource.setClientData(serviceRequest, merchantRefCode);
    CybersourceHelper.ccCreditService(serviceRequest, merchantRefCode, requestID, paymentType);

    //  Provide ability to customize request object with a hook.
    var HookMgr = require('dw/system/HookMgr');
    if (HookMgr.hasHook('app.cybersource.modifyrequest')) {
        var modifiedServiceRequest = HookMgr.callHook('app.cybersource.modifyrequest', 'Credit', serviceRequest);
        if (!empty(modifiedServiceRequest)) {
            serviceRequest = modifiedServiceRequest;
        }
    }

    var serviceResponse = null;
    // send request
    try {
        var service = CSServices.CyberSourceTransactionService;
        var merchantCrdentials = CybersourceHelper.getMerhcantCredentials(CybersourceConstants.METHOD_CREDIT_CARD);
        var requestWrapper = {};
	    serviceRequest.merchantID = merchantCrdentials.merchantID;
        requestWrapper.request = serviceRequest;
        requestWrapper.merchantCredentials = merchantCrdentials;
        serviceResponse = service.call(requestWrapper);
    } catch (e) {
        Logger.error('[CardFacade.js] Error in CCCaptureRequest request ( {0} )', e.message);
        return { error: true, errorMsg: e.message };
    }

    if (empty(serviceResponse) || serviceResponse.status !== 'OK') {
        Logger.error('[CardFacade.js] response in CCCaptureRequest response ( {0} )', serviceResponse);
        return { error: true, errorMsg: 'empty or error in CCCaptureRequest response: ' + serviceResponse };
    }
    serviceResponse = serviceResponse.object;
    return serviceResponse;
}

module.exports = {
    PayerAuthEnrollCheck: PayerAuthEnrollCheck,
    PayerAuthValidation: PayerAuthValidation,
    CCAuthRequest: CCAuthRequest,
    DAVRequest: DAVRequest,
    CCAuthReversalService: CCAuthReversalService,
    CCCaptureRequest: CCCaptureRequest,
    CCCreditRequest: CCCreditRequest
};
