/**
* migrateOldCardToken.js
* This file has been used to migrate old card token to new token by
* setting old credit card number to credit card token when maskedFourDigit
* field is present in the custom of payment instrument
*
* @input PaymentInstruments : dw.util.Collection
*
*/

/**
 * This function just execute the script file from pipeline by calling 
 * migrateOldCardToken function
 *
 * @param args : PipelineDictionary
 */
function execute( args : PipelineDictionary ) : Number
{
	migrateOldCardToken(args.PaymentInstruments);
	return PIPELET_NEXT;
}

/**
 * This function iterate the customer's payment instruments list
 * and set credti card number to credit card token when maskedFourDigit
 * custom field is present in payment instrument
 *
 * @param PaymentInstruments : PaymentInstruments
 */
function migrateOldCardToken(PaymentInstruments){
	var Transaction = require('dw/system/Transaction');
	Transaction.wrap(function(){
		for each(var paymentInstruments in PaymentInstruments){
			if(('isSubscription' in paymentInstruments.custom && paymentInstruments.custom.isSubscription) && ('maskedFourDigit' in paymentInstruments.custom && !empty(paymentInstruments.custom.maskedFourDigit))
				&& empty(paymentInstruments.creditCardToken)){
					paymentInstruments.creditCardToken = paymentInstruments.creditCardNumber;
			}
		}
	});
	return true;
}

module.exports = {
      'MigrateOldCardToken': migrateOldCardToken};
