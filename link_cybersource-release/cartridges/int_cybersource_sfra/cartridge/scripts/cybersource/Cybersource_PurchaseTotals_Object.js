/**
* Cybersource_PurchaseTotals_Object.js
* This Object is used for the Cybersource PurchaseTotals xsd
*/
function PurchaseTotals_Object() {
    this.grandTotalAmount;
    this.currency;
    this.discountAmount;
    this.taxAmount;
    this.dutyAmount;
    this.freightAmount;
    this.shippingAmount;
    this.subtotalAmount;
    this.shippingDiscountAmount;
}

PurchaseTotals_Object.prototype = {
    setGrandTotalAmount: function (value) {
        this.grandTotalAmount = value;
    },
    getGrandTotalAmount: function () {
        return this.grandTotalAmount;
    },
    setCurrency: function (value) {
        this.currency = value;
    },
    getCurrency: function () {
        return this.currency;
    },
    setDiscountAmount: function (value) {
        this.discountAmount = value;
    },
    getDiscountAmount: function () {
        return this.discountAmount;
    },
    setTaxAmount: function (value) {
        this.taxAmount = value;
    },
    getTaxAmount: function () {
        return this.taxAmount;
    },
    setDutyAmount: function (value) {
        this.dutyAmount = value;
    },
    getDutyAmount: function () {
        return this.dutyAmount;
    },
    setFreightAmount: function (value) {
        this.freightAmount = value;
    },
    getFreightAmount: function () {
        return this.freightAmount;
    },
    setShippingAmount: function (value) {
	   this.shippingAmount = value;
    },
    getShippingAmount: function (value) {
	 return this.shippingAmount;
    },
    setSubtotalAmount: function (value) {
	   this.subtotalAmount = value;
    },
    getSubtotalAmount: function (value) {
	 return this.subtotalAmount;
    },
    setShippingDiscountAmount: function (value) {
	   this.shippingDiscountAmount = value;
    },
    getShippingDiscountAmount: function (value) {
	 return this.shippingDiscountAmount;
    }
};
module.exports = PurchaseTotals_Object;
