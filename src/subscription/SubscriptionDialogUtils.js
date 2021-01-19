// @flow
import {logins} from "../api/main/LoginController"
import {load} from "../api/main/Entity"
import {CustomerTypeRef} from "../api/entities/sys/Customer"
import {neverNull} from "../api/common/utils/Utils"
import {Dialog} from "../gui/base/Dialog"
import {isIOSApp} from "../api/Env"
import {lang} from "../misc/LanguageViewModel"
import {showUpgradeWizard} from "./UpgradeSubscriptionWizard"
import {formatPrice} from "./SubscriptionUtils"

export function showNotAvailableForFreeDialog(isInPremiumIncluded: boolean) {
	if (isIOSApp()) {
		Dialog.error("notAvailableInApp_msg")
	} else {
		let message = lang.get(!isInPremiumIncluded ? "onlyAvailableForPremiumNotIncluded_msg" : "onlyAvailableForPremium_msg") + " "
			+ lang.get("premiumOffer_msg", {"{1}": formatPrice(1, true)})
		Dialog.reminder(lang.get("upgradeReminderTitle_msg"), message, lang.getInfoLink("premiumProBusiness_link"))
		      .then(confirmed => {
			      if (confirmed) {
				      showUpgradeWizard()
			      }
		      })
	}
}

export function createNotAvailableForFreeClickHandler(includedInPremium: boolean,
                                                      click: clickHandler,
                                                      available: () => boolean): clickHandler {
	return (e, dom) => {
		if (!available()) {
			showNotAvailableForFreeDialog(includedInPremium)
		} else {
			click(e, dom)
		}
	}
}

export function premiumSubscriptionActive(included: boolean): Promise<boolean> {
	if (logins.getUserController().isFreeAccount()) {
		showNotAvailableForFreeDialog(included)
		return Promise.resolve(false)
	}
	return load(CustomerTypeRef, neverNull(logins.getUserController().user.customer)).then((customer) => {
		if (customer.canceledPremiumAccount) {
			return Dialog.error("subscriptionCancelledMessage_msg").return(false)
		} else {
			return Promise.resolve(true)
		}
	})
}