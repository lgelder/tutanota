// @flow
import m from "mithril"
import stream from "mithril/stream/stream.js"
import {lang} from "../misc/LanguageViewModel"
import type {UpgradeSubscriptionData} from "./UpgradeSubscriptionWizard"
import {SubscriptionSelector} from "./SubscriptionSelector"
import {isApp, isTutanotaDomain} from "../api/Env"
import {client} from "../misc/ClientDetector"
import {ButtonN, ButtonType} from "../gui/base/ButtonN"
import {getSubscriptionPrice, SubscriptionType, UpgradePriceType, UpgradeType} from "./SubscriptionUtils"
import {Dialog, DialogType} from "../gui/base/Dialog"
import type {WizardPageAttrs, WizardPageN} from "../gui/base/WizardDialogN"
import {emitWizardEvent, WizardEventType} from "../gui/base/WizardDialogN"
import {DefaultAnimationTime} from "../gui/animation/Animations"
import type {ButtonAttrs} from "../gui/base/ButtonN"
import {Keys} from "../api/common/TutanotaConstants"
import {CheckboxN} from "../gui/base/CheckboxN"
import type {SubscriptionTypeEnum} from "./SubscriptionUtils"

export class UpgradeSubscriptionPage implements WizardPageN<UpgradeSubscriptionData> {

	view(vnode: Vnode<WizardPageAttrs<UpgradeSubscriptionData>>): Children {
		const a = vnode.attrs
		return m("#upgrade-account-dialog.pt", [
				m(SubscriptionSelector, {
					options: a.data.options,
					campaignInfoTextId: a.data.campaignInfoTextId,
					boxWidth: 230,
					boxHeight: 250,
					highlightPremium: true,
					premiumPrices: a.data.premiumPrices,
					premiumBusinessPrices: a.data.premiumBusinessPrices,
					teamsPrices: a.data.teamsPrices,
					teamsBusinessPrices: a.data.teamsBusinessPrices,
					proPrices: a.data.proPrices,
					isInitialUpgrade: a.data.upgradeType !== UpgradeType.Switch,
					currentlyActive: a.data.currentSubscription,
					currentlySharingOrdered: false,
					currentlyWhitelabelOrdered: false,
					freeActionButton: {
						view: () => {
							return m(ButtonN, {
								label: "pricing.select_action",
								click: () => {
									confirmFreeSubscription().then(confirmed => {
										if (confirmed) {
											a.data.type = SubscriptionType.Free
											a.data.price = "0"
											a.data.priceNextYear = "0"
											emitWizardEvent(vnode.dom, WizardEventType.SHOWNEXTPAGE)
										}
									})
								},
								type: ButtonType.Login,
							})
						}
					},
					premiumActionButton: createUpgradeButton(vnode, SubscriptionType.Premium),
					premiumBusinessActionButton: createUpgradeButton(vnode, SubscriptionType.PremiumBusiness),
					teamsActionButton:createUpgradeButton(vnode, SubscriptionType.Teams),
					teamsBusinessActionButton: createUpgradeButton(vnode, SubscriptionType.TeamsBusiness),
					proActionButton: createUpgradeButton(vnode, SubscriptionType.Pro)
				})
			]
		)
	}
}


function createUpgradeButton(vnode: Vnode<WizardPageAttrs<UpgradeSubscriptionData>>, subscriptionType:SubscriptionTypeEnum):Component {
	const a = vnode.attrs
	const wizardElement= vnode.dom
	return {
		view: () => {
			return m(ButtonN, {
				label: "pricing.select_action",
				click: () => {
					a.data.type = subscriptionType
					a.data.price = String(getSubscriptionPrice(a.data, subscriptionType, UpgradePriceType.PlanActualPrice))
					let nextYear = String(getSubscriptionPrice(a.data, subscriptionType, UpgradePriceType.PlanNextYearsPrice))
					a.data.priceNextYear = (a.data.price !== nextYear) ? nextYear : null
					emitWizardEvent(wizardElement, WizardEventType.SHOWNEXTPAGE)
				},
				type: ButtonType.Login,
			})
		}
	}
}

function confirmFreeSubscription(): Promise<boolean> {
	return new Promise(resolve => {
		let oneAccountValue = stream(false)
		let privateUseValue = stream(false)

		const buttons: Array<ButtonAttrs> = [
			{label: "cancel_action", click: () => closeAction(false), type: ButtonType.Secondary},
			{
				label: "ok_action", click: () => {
					if (oneAccountValue() && privateUseValue()) {
						closeAction(true)
					}
				}, type: ButtonType.Primary
			},
		]
		let dialog: Dialog
		const closeAction = confirmed => {
			dialog.close()
			setTimeout(() => resolve(confirmed), DefaultAnimationTime)
		}

		dialog = new Dialog(DialogType.Alert, {
			view: () => [
				// m(".h2.pb", lang.get("confirmFreeAccount_label")),
				m("#dialog-message.dialog-contentButtonsBottom.text-break.text-prewrap.selectable", lang.getMaybeLazy("freeAccountInfo_msg")),
				m(".dialog-contentButtonsBottom", [
					m(CheckboxN, {
						label: () => lang.get("confirmNoOtherFreeAccount_msg"),
						checked: oneAccountValue
					}),
					m(CheckboxN, {
						label: () => lang.get("confirmPrivateUse_msg"),
						checked: privateUseValue
					}),
				]),
				m(".flex-center.dialog-buttons", buttons.map(a => m(ButtonN, a)))
			]
		}).setCloseHandler(() => closeAction(false))
		  .addShortcut({
			  key: Keys.ESC,
			  shift: false,
			  exec: () => closeAction(false),
			  help: "cancel_action"
		  })
		  .addShortcut({
			  key: Keys.RETURN,
			  shift: false,
			  exec: () => closeAction(true),
			  help: "ok_action",
		  })
		  .show()
	})
}

export class UpgradeSubscriptionPageAttrs implements WizardPageAttrs<UpgradeSubscriptionData> {

	data: UpgradeSubscriptionData

	constructor(upgradeData: UpgradeSubscriptionData) {
		this.data = upgradeData
	}

	headerTitle(): string {
		return lang.get("subscription_label")
	}

	nextAction(showErrorDialog: boolean): Promise<boolean> {
		// next action not available for this page
		return Promise.resolve(true)
	}

	isSkipAvailable(): boolean {
		return false
	}

	isEnabled(): boolean {
		return isTutanotaDomain() && !(isApp() && client.isIos())
	}

}
