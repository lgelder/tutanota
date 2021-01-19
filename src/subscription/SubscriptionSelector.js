//@flow
import m from "mithril"
import type {TranslationKey} from "../misc/LanguageViewModel"
import {lang} from "../misc/LanguageViewModel"
import type {BuyOptionBoxAttr} from "./BuyOptionBox"
import {BOX_MARGIN, BuyOptionBox, getActiveSubscriptionActionButtonReplacement} from "./BuyOptionBox"
import type {SubscriptionOptions, SubscriptionPlanPrices, SubscriptionTypeEnum} from "./SubscriptionUtils"
import {
	formatPrice,
	getActionButtonBySubscription,
	getFormattedSubscriptionPrice,
	getPlanPrices,
	subscriptions,
	SubscriptionType,
	UpgradePriceType
} from "./SubscriptionUtils"
import type {SegmentControlItem} from "../gui/base/SegmentControl"
import {SegmentControl} from "../gui/base/SegmentControl"

const BusinessUseItems: SegmentControlItem<boolean>[] = [
	{name: lang.get("pricing.privateUse_label"), value: false},
	{name: lang.get("pricing.businessUse_label"), value: true}
]

export type SubscriptionActionButtons = {|
	Free: Component,
	Premium: Component,
	PremiumBusiness: Component,
	Teams: Component,
	TeamsBusiness: Component,
	Pro: Component,
|}

export type SubscriptionSelectorAttr = {|
	options: SubscriptionOptions,
	campaignInfoTextId: ?TranslationKey,
	actionButtons: SubscriptionActionButtons,
	boxWidth: number,
	boxHeight: number,
	highlightPremium?: boolean,
	currentlyActive?: ?SubscriptionTypeEnum,
	currentlySharingOrdered: boolean,
	currentlyBusinessOrdered: boolean,
	currentlyWhitelabelOrdered: boolean,
	isInitialUpgrade: boolean,
	planPrices: SubscriptionPlanPrices
|}

export class SubscriptionSelector implements MComponent<SubscriptionSelectorAttr> {
	_containerDOM: ?Element;

	view(vnode: Vnode<SubscriptionSelectorAttr>): Children {
		let buyBoxesViewPlacement
		if (vnode.attrs.options.businessUse()) {
			buyBoxesViewPlacement = [
				m(BuyOptionBox, this._createUpgradeBoxAttr(vnode.attrs, SubscriptionType.PremiumBusiness)),
				m(BuyOptionBox, this._createUpgradeBoxAttr(vnode.attrs, SubscriptionType.TeamsBusiness)),
				m(BuyOptionBox, this._createUpgradeBoxAttr(vnode.attrs, SubscriptionType.Pro)),
				m(".smaller.mb", lang.get("downgradeToPrivateNotAllowed_msg")) //only displayed when business options are shown
			]
		} else {
			// Add BuyOptionBox margin twice to the boxWidth received
			const columnWidth = vnode.attrs.boxWidth + (BOX_MARGIN * 2);
			// Changes order of BuyBoxes to Premium Pro Free, needed for mobile view (one column layout)
			if (this._containerDOM && this._containerDOM.clientWidth < columnWidth * 2) {
				buyBoxesViewPlacement = [
					m(BuyOptionBox, this._createUpgradeBoxAttr(vnode.attrs, SubscriptionType.Premium)),
					m(BuyOptionBox, this._createUpgradeBoxAttr(vnode.attrs, SubscriptionType.Teams)),
					m(BuyOptionBox, this._createUpgradeBoxAttr(vnode.attrs, SubscriptionType.Free))
				]
			} else {
				buyBoxesViewPlacement = [
					m(BuyOptionBox, this._createUpgradeBoxAttr(vnode.attrs, SubscriptionType.Free)),
					m(BuyOptionBox, this._createUpgradeBoxAttr(vnode.attrs, SubscriptionType.Premium)),
					m(BuyOptionBox, this._createUpgradeBoxAttr(vnode.attrs, SubscriptionType.Teams))
				]
			}
		}
		return [
			vnode.attrs.isInitialUpgrade ? m(SegmentControl, {
				selectedValue: vnode.attrs.options.businessUse,
				items: BusinessUseItems
			}) : null,
			vnode.attrs.campaignInfoTextId
			&& lang.exists(vnode.attrs.campaignInfoTextId) ? m(".b.center.mt", lang.get(vnode.attrs.campaignInfoTextId)) : null,
			m(".flex.center-horizontally.wrap", {
					oncreate: (vnode) => {
						this._containerDOM = vnode.dom;
						m.redraw();
					},
				},
				buyBoxesViewPlacement)
		]
	}

	_createFreeUpgradeBoxAttr(selectorAttrs: SubscriptionSelectorAttr): BuyOptionBoxAttr {
		return {
			heading: 'Free',
			actionButton: selectorAttrs.currentlyActive === SubscriptionType.Free
				? getActiveSubscriptionActionButtonReplacement()
				: selectorAttrs.actionButtons.Free,
			price: formatPrice(0, true),
			originalPrice: formatPrice(0, true),
			helpLabel: "pricing.upgradeLater_msg",
			features: () => [
				lang.get("pricing.comparisonUsersFree_msg"),
				lang.get("pricing.comparisonStorage_msg", {"{amount}": 1}),
				lang.get("pricing.comparisonDomainFree_msg"),
				lang.get("pricing.comparisonSearchFree_msg"),
				lang.get("pricing.comparisonOneCalendar_msg"),
			],
			width: selectorAttrs.boxWidth,
			height: selectorAttrs.boxHeight,
			paymentInterval: null,
			showReferenceDiscount: selectorAttrs.isInitialUpgrade
		}
	}

	_createUpgradeBoxAttr(selectorAttrs: SubscriptionSelectorAttr, subscription: SubscriptionTypeEnum): BuyOptionBoxAttr {
		const planPrices = getPlanPrices(selectorAttrs.planPrices, subscription)
		if (!planPrices) { // no prices for the plan means subscription === SubscriptionType.Free (special case)
			return this._createFreeUpgradeBoxAttr(selectorAttrs)
		}
		const subscriptionConfig = subscriptions[subscription]

		const premiumFeatures = [
			lang.get("pricing.comparisonAddUser_msg", {"{1}": getFormattedSubscriptionPrice(selectorAttrs, subscription, UpgradePriceType.AdditionalUserPrice)}),
			lang.get("pricing.comparisonStorage_msg", {"{amount}": planPrices.includedStorage}),
			lang.get(subscriptionConfig.business || selectorAttrs.currentlyBusinessOrdered
				? "pricing.comparisonDomainBusiness_msg"
				: "pricing.comparisonDomainPremium_msg"),
			lang.get("pricing.comparisonSearchPremium_msg"),
			lang.get("pricing.comparisonMultipleCalendars_msg"),
			lang.get("pricing.mailAddressAliasesShort_label", {"{amount}": planPrices.includedAliases}),
			lang.get("pricing.comparisonInboxRulesPremium_msg"),
			lang.get(subscription === SubscriptionType.Pro
				? "pricing.comparisonSupportPro_msg"
				: "pricing.comparisonSupportPremium_msg")
		]
		const sharingFeature = [lang.get("pricing.comparisonSharingCalendar_msg")]
		const businessFeatures = [
			lang.get("pricing.comparisonOutOfOffice_msg"),
			lang.get("pricing.comparisonCalendarInvites_msg")
		]
		const whitelabelFeatures = [
			lang.get("pricing.comparisonLoginPro_msg"),
			lang.get("pricing.comparisonThemePro_msg"),
			// TODO correct prices should also be available for other subscriptions but Pro
			lang.get("pricing.comparisonContactFormPro_msg", {"{price}": getFormattedSubscriptionPrice(selectorAttrs, SubscriptionType.Pro, UpgradePriceType.ContactFormPrice)})
		]
		const featuresToBeBought = premiumFeatures
			.concat(subscriptionConfig.business || selectorAttrs.currentlyBusinessOrdered ? businessFeatures : [])
			.concat(subscriptionConfig.sharing || selectorAttrs.currentlySharingOrdered ? sharingFeature : [])
			.concat(subscriptionConfig.whitelabel || selectorAttrs.currentlyWhitelabelOrdered ? whitelabelFeatures : [])

		return {
			heading: subscription.replace("Business", ""),
			actionButton: selectorAttrs.currentlyActive === subscription
				? getActiveSubscriptionActionButtonReplacement()
				: getActionButtonBySubscription(selectorAttrs.actionButtons, subscription),
			price: getFormattedSubscriptionPrice(selectorAttrs, subscription, UpgradePriceType.PlanActualPrice),
			originalPrice: getFormattedSubscriptionPrice(selectorAttrs, subscription, UpgradePriceType.PlanReferencePrice),
			helpLabel: selectorAttrs.options.businessUse() ? "pricing.basePriceExcludesTaxes_msg" : "pricing.basePriceIncludesTaxes_msg",
			features: () => featuresToBeBought,
			width: selectorAttrs.boxWidth,
			height: selectorAttrs.boxHeight,
			paymentInterval: selectorAttrs.isInitialUpgrade ? selectorAttrs.options.paymentInterval : null,
			highlighted: !selectorAttrs.options.businessUse() && selectorAttrs.highlightPremium,
			showReferenceDiscount: selectorAttrs.isInitialUpgrade
		}
	}
}
