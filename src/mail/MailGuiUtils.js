//@flow
import {MailModel} from "./MailModel"
import type {Mail} from "../api/entities/tutanota/Mail"
import {LockedError, PreconditionFailedError} from "../api/common/error/RestError"
import {Dialog} from "../gui/base/Dialog"
import {showDeleteConfirmationDialog} from "./MailUtils"
import type {MailFolder} from "../api/entities/tutanota/MailFolder"

export function promptAndDeleteMails(mailModel: MailModel, mails: $ReadOnlyArray<Mail>, onConfirm: () => void): Promise<void> {
	return showDeleteConfirmationDialog(mails).then(() => {
		onConfirm()

		return mailModel.deleteMails(mails)
			// FIXME: do not import dialog here
			            .catch(PreconditionFailedError, e => Dialog.error("operationStillActive_msg"))
			            .catch(LockedError, e => Dialog.error("operationStillActive_msg")) //LockedError should no longer be thrown!?!
	})
}

export function moveMails(mailModel: MailModel, mails: $ReadOnlyArray<Mail>, targetMailFolder: MailFolder): Promise<void> {
	return mailModel.moveMails(mails, targetMailFolder)
	                .catch(LockedError, e => Dialog.error("operationStillActive_msg")) //LockedError should no longer be thrown!?!
	                .catch(PreconditionFailedError, e => Dialog.error("operationStillActive_msg"))
}