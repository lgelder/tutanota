//@flow
import m from "mithril"
import type {TranslationKey} from "../misc/LanguageViewModel"
import {lang} from "../misc/LanguageViewModel"
import type {BookingItemFeatureTypeEnum} from "../api/common/TutanotaConstants"
import {AccountType, BookingItemFeatureType, Const} from "../api/common/TutanotaConstants"
import {getCurrentCount} from "./PriceUtils"
import {PreconditionFailedError} from "../api/common/error/RestError"
import type {SegmentControlItem} from "../gui/base/SegmentControl"
import type {PlanPrices} from "../api/entities/sys/PlanPrices"
import type {Customer} from "../api/entities/sys/Customer"
import type {CustomerInfo} from "../api/entities/sys/CustomerInfo"
import type {Booking} from "../api/entities/sys/Booking"
import {createBookingServiceData} from "../api/entities/sys/BookingServiceData"
import {serviceRequestVoid} from "../api/main/Entity"
import {SysService} from "../api/entities/sys/Services"
import {HttpMethod} from "../api/common/EntityFunctions"
import {Dialog} from "../gui/base/Dialog"
import {asyncImport} from "../api/common/utils/Utils"
import type {DialogHeaderBarAttrs} from "../gui/base/DialogHeaderBar"
import {htmlSanitizer} from "../misc/HtmlSanitizer"
import {ButtonType} from "../gui/base/ButtonN"
import {ProgrammingError} from "../api/common/error/ProgrammingError"
import type {SubscriptionActionButtons} from "./SubscriptionSelector"

export type SubscriptionOptions = {
	businessUse: Stream<boolean>,
	paymentInterval: Stream<number>
}

export const SubscriptionType = Object.freeze({
	Free: 'Free',
	Premium: 'Premium',
	PremiumBusiness: 'PremiumBusiness',
	Teams: 'Teams',
	TeamsBusiness: 'TeamsBusiness',
	Pro: 'Pro'
})
export type SubscriptionTypeEnum = $Values<typeof SubscriptionType>;

export const UpgradeType = {
	Signup: 'Signup', // during signup
	Initial: 'Initial', // when logged in into Free account
	Switch: 'Switch' // switching in paid account
}
export type UpgradeTypeEnum = $Values<typeof UpgradeType>;


export const PaymentIntervalItems: SegmentControlItem<number>[] = [
	{name: lang.get("pricing.yearly_label"), value: 12},
	{name: lang.get("pricing.monthly_label"), value: 1}
]

export const BusinessUseItems: SegmentControlItem<boolean>[] = [
	{name: lang.get("pricing.privateUse_label"), value: false},
	{name: lang.get("pricing.businessUse_label"), value: true}
]

export type SubscriptionConfig = {|
	nbrOfAliases: number,
	orderNbrOfAliases: number,
	storageGb: number,
	orderStorageGb: number,
	sharing: boolean,
	business: boolean,
	whitelabel: boolean,
|}

export const subscriptions: {[SubscriptionTypeEnum]: SubscriptionConfig} = {}
subscriptions[SubscriptionType.Free] = {
	nbrOfAliases: 0,
	orderNbrOfAliases: 0,
	storageGb: 1,
	orderStorageGb: 0,
	sharing: false,
	business: false,
	whitelabel: false
}
subscriptions[SubscriptionType.Premium] = {
	nbrOfAliases: 5,
	orderNbrOfAliases: 0,
	storageGb: 1,
	orderStorageGb: 0,
	sharing: false,
	business: false,
	whitelabel: false
}
subscriptions[SubscriptionType.PremiumBusiness] = {
	nbrOfAliases: 5,
	orderNbrOfAliases: 0,
	storageGb: 1,
	orderStorageGb: 0,
	sharing: false,
	business: true,
	whitelabel: false
}
subscriptions[SubscriptionType.Teams] = {
	nbrOfAliases: 5,
	orderNbrOfAliases: 0,
	storageGb: 10,
	orderStorageGb: 10,
	sharing: true,
	business: false,
	whitelabel: false
}
subscriptions[SubscriptionType.TeamsBusiness] = {
	nbrOfAliases: 5,
	orderNbrOfAliases: 0,
	storageGb: 10,
	orderStorageGb: 10,
	sharing: true,
	business: true,
	whitelabel: false
}
subscriptions[SubscriptionType.Pro] = {
	nbrOfAliases: 20,
	orderNbrOfAliases: 20,
	storageGb: 10,
	orderStorageGb: 10,
	sharing: true,
	business: true,
	whitelabel: true
}

/**
 * Only check if there are additional features (not if a feature is removed/reduced)
 * @returns {boolean} true if new features are included in the targetSubscription missing in the currentSubscription
 */
export function addsMoreFeatures(targetSubscription: SubscriptionTypeEnum, currentSubscription: SubscriptionTypeEnum): boolean {
	const targetFeatures = subscriptions[targetSubscription]
	const currentFeatures = subscriptions[currentSubscription]
	return Object.keys(targetFeatures).some((feature) => {
		if (typeof targetFeatures[feature] === "boolean" && typeof currentFeatures[feature] === "boolean") {
			return !!(targetFeatures[feature] && !currentFeatures[feature])
		} else if (typeof targetFeatures[feature] === "number" && typeof currentFeatures[feature] === "number") {
			return targetFeatures[feature] > currentFeatures[feature]
		} else {
			throw new ProgrammingError("Features have incompatible types")
		}
	})
}

export function getActionButtonBySubscription(actionButtons: SubscriptionActionButtons, subscription: SubscriptionTypeEnum): Component {
	switch (subscription) {
		case SubscriptionType.Free:
			return actionButtons.Free
		case SubscriptionType.Premium:
			return actionButtons.Premium
		case SubscriptionType.PremiumBusiness:
			return actionButtons.PremiumBusiness
		case SubscriptionType.Teams:
			return actionButtons.Teams
		case SubscriptionType.TeamsBusiness:
			return actionButtons.TeamsBusiness
		case SubscriptionType.Pro:
			return actionButtons.Pro
		default:
			throw new ProgrammingError("Plan is not valid")
	}
}

// keep this function here because we also need it on the website
export function formatPrice(value: number, includeCurrency: boolean): string {
	// round to two digits first because small deviations may exist at far away decimal places
	value = Math.round(value * 100) / 100
	if (includeCurrency) {
		return (value % 1 !== 0) ?
			lang.formats.priceWithCurrency.format(value)
			: lang.formats.priceWithCurrencyWithoutFractionDigits.format(value)
	} else {
		return (value % 1 !== 0) ?
			lang.formats.priceWithoutCurrency.format(value)
			: lang.formats.priceWithoutCurrencyWithoutFractionDigits.format(value)
	}
}

export type SubscriptionPlanPrices = {|
	Premium: PlanPrices,
	PremiumBusiness: PlanPrices,
	Teams: PlanPrices,
	TeamsBusiness: PlanPrices,
	Pro: PlanPrices,
|}

export type SubscriptionData = {
	options: SubscriptionOptions,
	planPrices: SubscriptionPlanPrices
}

export const UpgradePriceType = Object.freeze({
	PlanReferencePrice: "0",
	PlanActualPrice: "1",
	PlanNextYearsPrice: "2",
	AdditionalUserPrice: "3",
	ContactFormPrice: "4",
})
export type UpgradePriceTypeEnum = $Values<typeof UpgradePriceType>;

export function getPlanPrices(prices: SubscriptionPlanPrices, subscription: SubscriptionTypeEnum,): ?PlanPrices {
	switch (subscription) {
		case SubscriptionType.Free:
			return null
		case SubscriptionType.Premium:
			return prices.Premium
		case SubscriptionType.PremiumBusiness:
			return prices.PremiumBusiness
		case SubscriptionType.Teams:
			return prices.Teams
		case SubscriptionType.TeamsBusiness:
			return prices.TeamsBusiness
		case SubscriptionType.Pro:
			return prices.Pro
		default:
			throw new ProgrammingError("Plan is not valid")
	}
}

export function getSubscriptionPrice(data: SubscriptionData, subscription: SubscriptionTypeEnum, type: UpgradePriceTypeEnum): number {
	const prices = getPlanPrices(data.planPrices, subscription)
	if (prices) {
		let monthlyPriceString
		let monthsFactor = (data.options.paymentInterval() === 12) ? 10 : 1
		let discount = 0
		if (type === UpgradePriceType.PlanReferencePrice) {
			monthlyPriceString = prices.monthlyReferencePrice
			if (data.options.paymentInterval() === 12) {
				monthsFactor = 12
			}
		} else if (type === UpgradePriceType.PlanActualPrice) {
			monthlyPriceString = prices.monthlyPrice
			if (data.options.paymentInterval() === 12) {
				discount = Number(prices.firstYearDiscount)
			}
		} else if (type === UpgradePriceType.PlanNextYearsPrice) {
			monthlyPriceString = prices.monthlyPrice
		} else if (type === UpgradePriceType.AdditionalUserPrice) {
			monthlyPriceString = prices.additionalUserPriceMonthly
		} else if (type === UpgradePriceType.ContactFormPrice) {
			monthlyPriceString = prices.contactFormPriceMonthly
		}
		return Number(monthlyPriceString) * monthsFactor - discount
	} else { // Free plan
		return 0
	}
}

export function getFormattedSubscriptionPrice(attrs: SubscriptionData, subscription: SubscriptionTypeEnum, type: UpgradePriceTypeEnum): string {
	return formatPrice(getSubscriptionPrice(attrs, subscription, type), true)
}

/**
 * Returns the available storage capacity for the customer in GB
 */
export function getTotalStorageCapacity(customer: Customer, customerInfo: CustomerInfo, lastBooking: ?Booking): number {
	let freeStorageCapacity = getIncludedStorageCapacity(customerInfo)
	if (customer.type === AccountType.PREMIUM) {
		return Math.max(freeStorageCapacity, getCurrentCount(BookingItemFeatureType.Storage, lastBooking))
	} else {
		return freeStorageCapacity
	}
}

export function getIncludedStorageCapacity(customerInfo: CustomerInfo): number {
	return Math.max(Number(customerInfo.includedStorageCapacity), Number(customerInfo.promotionStorageCapacity))
}

export function getTotalAliases(customer: Customer, customerInfo: CustomerInfo, lastBooking: ?Booking): number {
	let freeAliases = getIncludedAliases(customerInfo)
	if (customer.type === AccountType.PREMIUM) {
		return Math.max(freeAliases, getCurrentCount(BookingItemFeatureType.Alias, lastBooking))
	} else {
		return freeAliases
	}
}

export function getNbrOfUsers(lastBooking: ?Booking): number {
	return getCurrentCount(BookingItemFeatureType.Users, lastBooking)
}

export function isWhitelabelActive(lastBooking: ?Booking): boolean {
	return getCurrentCount(BookingItemFeatureType.Whitelabel, lastBooking) !== 0
}

export function isSharingActive(lastBooking: ?Booking): boolean {
	return getCurrentCount(BookingItemFeatureType.Sharing, lastBooking) !== 0
}

export function isBusinessActive(lastBooking: ?Booking): boolean {
	return getCurrentCount(BookingItemFeatureType.Business, lastBooking) !== 0
}

export function getIncludedAliases(customerInfo: CustomerInfo): number {
	return Math.max(Number(customerInfo.includedEmailAliases), Number(customerInfo.promotionEmailAliases))
}

export function getSubscriptionType(lastBooking: ?Booking, customer: Customer, customerInfo: CustomerInfo): SubscriptionTypeEnum {
	if (customer.type !== AccountType.PREMIUM) {
		return SubscriptionType.Free
	}
	let aliases = getTotalAliases(customer, customerInfo, lastBooking)
	let storage = getTotalStorageCapacity(customer, customerInfo, lastBooking)
	if (isSharingActive(lastBooking) && isWhitelabelActive(lastBooking) && aliases >= 20 && storage >= 10) {
		return SubscriptionType.Pro
	} else if (isSharingActive(lastBooking) && storage >= 10) {
		return SubscriptionType.Teams
	} else {
		return SubscriptionType.Premium
	}
}

export function getPreconditionFailedPaymentMsg(data: ?string): TranslationKey {
	switch (data) {
		case "paypal.change":
			return "payChangeError_msg"
		case "paypal.confirm_again":
			return "payPaypalConfirmAgainError_msg"
		case "paypal.other_source":
			return "payPaypalChangeSourceError_msg"
		case "card.contact_bank":
			return "payCardContactBankError_msg"
		case "card.insufficient_funds":
			return "payCardInsufficientFundsError_msg"
		case "card.expired_card":
			return "payCardExpiredError_msg"
		case "card.change":
			return "payChangeError_msg"
		case "card.3ds2_needed":
			return "creditCardPaymentErrorVerificationNeeded_msg"
		case "card.3ds2_pending":
			return "creditCardPendingVerification_msg"
		case "card.3ds2_failed":
			return "creditCardDeclined_msg"
		default:
			return "payContactUsError_msg"
	}
}

/**
 * @returns True if it failed, false otherwise
 */
export function bookItem(featureType: BookingItemFeatureTypeEnum, amount: number): Promise<boolean> {
	const bookingData = createBookingServiceData({
		amount: amount.toString(),
		featureType,
		date: Const.CURRENT_DATE
	})
	return serviceRequestVoid(SysService.BookingService, HttpMethod.POST, bookingData).return(false).catch(PreconditionFailedError, error => {
		console.log(error)
		return Dialog.error(error.data === "balance.insufficient"
			? "insufficientBalanceError_msg"
			: getBookingItemErrorMsg(featureType)).return(true)
	})
}

export function buyAliases(amount: number): Promise<boolean> {
	return bookItem(BookingItemFeatureType.Alias, amount)
}

export function buyStorage(amount: number): Promise<boolean> {
	return bookItem(BookingItemFeatureType.Storage, amount);
}

/**
 * @returns True if it failed, false otherwise
 */
export function buyWhitelabel(enable: boolean): Promise<boolean> {
	return bookItem(BookingItemFeatureType.Whitelabel, enable ? 1 : 0)
}

/**
 * @returns True if it failed, false otherwise
 */
export function buySharing(enable: boolean): Promise<boolean> {
	return bookItem(BookingItemFeatureType.Sharing, enable ? 1 : 0)
}

/**
 * @returns True if it failed, false otherwise
 */
export function buyBusiness(enable: boolean): Promise<boolean> {
	return bookItem(BookingItemFeatureType.Business, enable ? 1 : 0)
}

export function showServiceTerms(section: "terms" | "privacy" | "giftCards") {
	asyncImport(typeof module !== "undefined"
		? module.id : __moduleName, `${env.rootPathPrefix}src/subscription/terms.js`)
		.then(terms => {
			let dialog: Dialog
			let visibleLang = lang.code.startsWith("de") ? "de" : "en"
			let sanitizedTerms: string
			let headerBarAttrs: DialogHeaderBarAttrs = {
				left: [
					{
						label: () => "EN/DE",
						click: () => {
							visibleLang = visibleLang === "de" ? "en" : "de"
							sanitizedTerms = htmlSanitizer.sanitize(terms[section + "_" + visibleLang], false).text
							m.redraw()
						},
						type: ButtonType.Secondary
					}
				],
				right: [{label: 'ok_action', click: () => dialog.close(), type: ButtonType.Primary}]
			}

			sanitizedTerms = htmlSanitizer.sanitize(terms[section + "_" + visibleLang], false).text
			dialog = Dialog.largeDialog(headerBarAttrs, {
				view: () => m(".text-break", m.trust(sanitizedTerms))
			}).show()
		})
}

function getBookingItemErrorMsg(feature: BookingItemFeatureTypeEnum): TranslationKey {
	switch (feature) {
		case BookingItemFeatureType.Alias:
			return "emailAliasesTooManyActivatedForBooking_msg"
		case BookingItemFeatureType.Storage:
			return "storageCapacityTooManyUsedForBooking_msg"
		case BookingItemFeatureType.Whitelabel:
			return "whitelabelDomainExisting_msg"
		case BookingItemFeatureType.Sharing:
			return "unknownError_msg"
		default:
			return "unknownError_msg"
	}
}

