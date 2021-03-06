/*
* Description of the module and the logic it provides
*
* @module cartridge/scripts/cardinal/JWTBuilder
*/
'use strict';
 
var Signature = require("dw/crypto/Signature");  
var Encoding = require('dw/crypto/Encoding');  
var Mac = require('dw/crypto/Mac'); 
var Bytes = require('dw/util/Bytes');  

/** 
 * The Keys. If you want to verify this in jwt.io, use the content of the files! 
 */

function generateTokenWithKey(orderObject) { 
    
    var libCybersource = require('~/cartridge/scripts/cybersource/libCybersource');
    var CybersourceHelper = libCybersource.getCybersourceHelper(); 
    
    var PRIVATEKEY = CybersourceHelper.getCruiseCredentialsApiKey();
    var issuer = CybersourceHelper.getCruiseCredentialsApiIdentifier();
    var orgUnitID = CybersourceHelper.getCruiseCredentialsOrgUnitId();
    var encoder = new Signature();  
    var mac = new Mac('HmacSHA256');
    var jti = generatejti();
    
    var time = Math.floor(new Date().getTime()/1000); 
    var exptime = Math.floor(new Date().getTime()/1000 + 120*60);

    let header = {  
            "alg": "HS256",
            "typ": "JWT"
    }; 
    
    let payload = "";
    if(!orderObject)
    {
         payload = {  
            "jti": jti,
            "iat": time,
            "exp": exptime,
            "iss": issuer,
            "OrgUnitId": orgUnitID,
        };    
    }else
    {
        payload = {  
            "jti": jti,
            "iat": time,
            "exp": exptime,
            "iss": issuer,
            "OrgUnitId": orgUnitID,
            "Payload" : orderObject
        };    
    }
      
    //Encode the Header as Base64  
    let headerBase64 = Encoding.toBase64(new Bytes(JSON.stringify(header)));  

    //Encode the Payload as Base64  
    let payloadBase64 = Encoding.toBase64(new Bytes(JSON.stringify(payload)));  

    //Create the content of the JWT Signature  
    var signature = headerBase64 + "." + payloadBase64;    
    var token = mac.digest(signature,PRIVATEKEY);

    var signatureUrlEncoded = Encoding.toBase64(token).replace(/\+/g, '-');
    signatureUrlEncoded = signatureUrlEncoded.replace(/\//g, '_').replace(/\=+$/m, '');

    //Now, create the signed JWT: Header + Payload + Signature concatenated with a dot  
    let jwt = headerBase64 + "." + payloadBase64 + "." + signatureUrlEncoded;  

    return jwt;  

} 
function generateTokenWithCertificate() {  
	var encoder = new Signature();  
	var PUBLICKEY = new CertificateRef('cs-public');
	var PRIVATEKEY = new dw.crypto.KeyRef('cs-songbird');
	var jti = generatejti();
	let header = {  
			"alg": "RS256",
			"typ": "JWT"
	};  

	let payload = {  
			"jti": jti,
			"iat": 1529595472,
			"exp": 1529602672,
			"iss": "5cf7391aafa80d2250fbbc8d",
			"OrgUnitId": "5b973e01ff626b13447d3fc3"  
	};  

	//Encode the Header as Base64  
	let headerBase64 = Encoding.toBase64(new Bytes(JSON.stringify(header)));  

	//Encode the Payload as Base64  
	let payloadBase64 = Encoding.toBase64(new Bytes(JSON.stringify(payload)));  

	//Create the content of the JWT Signature  
	var signature = Encoding.toBase64(new Bytes(headerBase64 + "." + payloadBase64));  

	//Encrypt the Signature (in RS256) - returns a Base64 String  
	var token = encoder.sign(signature, PRIVATEKEY, 'SHA256withRSA');  

	/** 
	 * URL Encode the Base64 string (pseudo-standard) 
	 * 
	 * Replace "+" with "-" 
	 * Replace "/" with "_" 
	 * Cut off the trailing "==" 
	 */  
	var signatureUrlEncoded = token.replace(/\+/g, '-').replace(/\//g, '_').replace(/\=+$/m, '');  

	//Quick check: Can we decode the string again here?  
	let verified = encoder.verifySignature(token, signature, PUBLICKEY, 'SHA256withRSA');  

	//Now, create the signed JWT: Header + Payload + Signature concatenated with a dot  
	let jwt = headerBase64 + "." + payloadBase64 + "." + signatureUrlEncoded;  

	return jwt;  
}

function generatejti(){
	var jti;
	jti = randomString(32);
	return jti;
}

function randomString(size) {
  var randomString = '';
  var randomchar = function() {
    var n = Math.floor(Math.random() * 62);
    if (n < 10) return n; //1-10
    if (n < 36) return String.fromCharCode(n + 55); //A-Z
    return String.fromCharCode(n + 61); //a-z
  }
  while (randomString.length < size) randomString += randomchar();
  return randomString;
}

module.exports = {
		generateTokenWithKey : generateTokenWithKey,
		generateTokenWithCertificate : generateTokenWithCertificate,
		generatejti : generatejti,
		randomString : randomString
};