// @flow
import m from "mithril"
import {fileController} from "../file/FileController"
import {Icon} from "../gui/base/Icon"
import {Icons} from "../gui/base/icons/Icons"
import type {MailContents} from "./MailUtils"

export type MailContentsDraggerAttrs = {
	contents: MailContents[]
}

export class MailContentsDragger implements MComponent<MailContentsDraggerAttrs> {
	view(vnode: Vnode<MailContentsDraggerAttrs>): Children {

		const a = vnode.attrs

		return m("", {
			draggable: true,
			ondragstart: e => {
				e.preventDefault()
				fileController.dragExportMails("msg", a.contents)
			}
		}, m(".flex.col.items-center", [
			m(Icon, {
				icon: Icons.Archive,
				class: "icon-message-box"
			}),
			m("p.m-0", "Drag me"), // TODO translate
		]))
	}
}