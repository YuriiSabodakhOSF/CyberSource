
/** *******************************************************************************
*
* Description: 	Class for Cybersource HTTP Service Initialization,
*
/*********************************************************************************/

var HashMap = require('dw/util/HashMap');
var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');

var Logger = require('dw/system/Logger');
var logger = Logger.getLogger("CyberSource" ,"RestAPIServices" );

/**
 *
 *	HTTP Services
 *
 */

var CyberSourceDMService = LocalServiceRegistry.createService("cybersource.conversiondetailreport", {
	createRequest: function(svc, requestObj, starttime, endtime, merchantId){
		svc.setRequestMethod("GET");
		svc.addHeader("Content-Type", "application/json");
		for each(var key in requestObj.keySet()){
	         svc.addHeader(key, requestObj.get(key));
		}
		svc.URL +='?startTime=' + starttime + '&endTime=' + endtime + '&organizationId=' + merchantId;
	},
	parseResponse: function(svc, client) {
		logger.debug( "Conversion Detail Report (Site Genesis) Request Data: {0}",JSON.stringify(svc.requestData)); 
		return client.text;
	},
    filterLogMessage: function(msg) {
                //  No need to filter logs.  No sensitive information.
            return msg;
    }
});

var CyberSourceFlexTokenService = LocalServiceRegistry.createService("cybersource.http.flextoken", {
	createRequest: function(svc, requestObj, digestString){
		svc.setRequestMethod("POST");
		svc.addHeader("Accept","application/json; charset=utf-8");
		svc.addHeader("Content-Type","application/json");
		for each(var key in requestObj.keySet()){
	         svc.addHeader(key, requestObj.get(key));
		}
		//logger.info( "Conversion Detail Report (Site Genesis) Request Data: {0}",JSON.stringify(requestObj));
		return digestString;
	},
	parseResponse: function(svc, client) {
		//logger.info( "Conversion Detail Report (Site Genesis) Request Data: {0}",JSON.stringify(svc.requestData));
		return client.text;
	},
    filterLogMessage: function(msg) {
            //  Filter Logging on production system.
        if (dw.system.System.getInstanceType() == dw.system.System.PRODUCTION_SYSTEM) {
                //  Filter Logic.
            try {
                if (empty(msg)){
                    return "Message Missing";
                }
                messageData = JSON.parse(msg);
                
                filteredData = {};
                if (messageData.hasOwnProperty("encryptionType")) {
                    filteredData.encryptionType = messageData.encryptionType;
                }
                if (messageData.hasOwnProperty("targetOrigin")) {
                    filteredData.targetOrigin = messageData.targetOrigin;
                }

                var filteredMessage = "PRODUCTION SYSTEM DETECTED.  RESPONSE HAS BEEN FILTERED : ";
                filteredMessage += JSON.stringify(filteredData);
            
                return filteredMessage;
            }
            catch(e) {
                    //  msg was not a JSON string.
                    //  In this case, we hide all data.
                return "Unable to parse Service log message."
            }
        }
        else {
                //  Return full message on other systems.
            return msg;
        }
    }
});

module.exports = {
		CyberSourceDMService : CyberSourceDMService,
		CyberSourceFlexTokenService: CyberSourceFlexTokenService
};