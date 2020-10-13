// @flow

import m from "mithril"
import type {KnowledgeBaseEntry} from "../api/entities/tutanota/KnowledgeBaseEntry"
import {EntityClient} from "../api/common/EntityClient"
import type {EntityUpdateData} from "../api/main/EventController"
import type {ButtonAttrs} from "../gui/base/ButtonN"
import {ButtonType} from "../gui/base/ButtonN"
import {ButtonN} from "../gui/base/ButtonN"
import {Icons} from "../gui/base/icons/Icons"
import {Dialog} from "../gui/base/Dialog"
import {KnowledgeBaseEditor} from "./KnowledgeBaseEditor"
import {getListId} from "../api/common/EntityFunctions"
import {memoized, neverNull} from "../api/common/utils/Utils"
import {locator} from "../api/main/MainLocator"
import {lang} from "../misc/LanguageViewModel"
import {htmlSanitizer} from "../misc/HtmlSanitizer"
import {startsWith} from "../api/common/utils/StringUtils"

/**
 *  Renders one knowledgebase entry in the settings
 */

export class KnowledgeBaseDetailsViewer {
	view: Function
	_entityClient: EntityClient
	_sanitizedEntry: (KnowledgeBaseEntry) => {content: string}

	constructor(entry: KnowledgeBaseEntry, entityClient: EntityClient) {
		this._entityClient = entityClient
		this._sanitizedEntry = memoized((entry) => {
			return {
				content: htmlSanitizer.sanitize(entry.useCase, true).text,
			}
		})

		const EditButtonAttrs: ButtonAttrs = {
			label: "edit_action",
			icon: () => Icons.Edit,
			type: ButtonType.Action,
			click: () => {
				new KnowledgeBaseEditor(entry, getListId(entry), neverNull(entry._ownerGroup), locator.entityClient)
			}
		}

		const RemoveButtonAttrs: ButtonAttrs = {
			label: "remove_action",
			icon: () => Icons.Trash,
			type: ButtonType.Action,
			click: () => {
				Dialog.confirm("deleteEntryConfirm_msg").then((confirmed) => {
					if (confirmed) {
						entityClient.erase(entry)
						            .then()
					}
				})
			}
		}

		this.view = () => {
			return m("#user-viewer.fill-absolute.scroll.plr-l.pb-floating", {
				onclick: (event) => {
					this._handleAnchorClick(event)
				}
			}, [
				m(".flex.mt-l.center-vertically", [
					m(".h4.text-ellipsis", entry.title),
					m(".flex.flex-grow.justify-end", [
						m(ButtonN, EditButtonAttrs),
						m(ButtonN, RemoveButtonAttrs)
					])
				]),
				m("", [
					m(".h5.mt-s", lang.get("keywords_label")),
					m(".flex.mt-s.wrap", [
						entry.keywords.map(entryKeyword => {
							return m(".bubbleTag", entryKeyword.keyword)
						})
					]),
					m(".flex.flex-column.mt-l", [
						m(".h5", lang.get("content_label")),
						m(".editor-border.overflow-wrap", m.trust(this._sanitizedEntry(entry).content)),
					]),
				])
			])
		}
	}

	_handleAnchorClick(event: Event): void {
		let target = (event.target: any)
		if(target && target.closest) {
			let anchorElement = target.closest("a")
			if (anchorElement && startsWith(anchorElement.href, "tutatemplate:")) {
				event.preventDefault()
			}
		}
	}

	entityEventsReceived(updates: $ReadOnlyArray<EntityUpdateData>): Promise<void> {
		return Promise.each(updates, update => {
			let p = Promise.resolve()
			return p.then(() => {
			})
		}).then(() => m.redraw())
	}
}