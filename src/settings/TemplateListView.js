//@flow

import m from "mithril"
import {ButtonN, ButtonType} from "../gui/base/ButtonN"
import {Dialog} from "../gui/base/Dialog"
import {lang} from "../misc/LanguageViewModel"
import type {EntityUpdateData} from "../api/main/EventController"
import {List} from "../gui/base/List"
import {size} from "../gui/size"
import {SettingsView} from "./SettingsView"
import {TemplateDetailsViewer} from "./TemplateDetailsViewer"
import {TemplateEditor} from "./TemplateEditor"
import {EmailTemplateTypeRef} from "../api/entities/tutanota/EmailTemplate"
import {locator} from "../api/main/MainLocator"
import type {EmailTemplate} from "../api/entities/tutanota/EmailTemplate"
import {assertMainOrNode} from "../api/Env"
import {isUpdateForTypeRef} from "../api/main/EventController"
import type {GroupMembership} from "../api/entities/sys/GroupMembership"
import {TemplateGroupRootTypeRef} from "../api/entities/tutanota/TemplateGroupRoot"
import type {TemplateGroupRoot} from "../api/entities/tutanota/TemplateGroupRoot"
import {neverNull} from "../api/common/utils/Utils"
import {UserController} from "../api/main/UserController"
import {TemplateGroupModel} from "../templates/TemplateGroupModel"
import {EntityClient} from "../api/common/EntityClient"
import {DropDownSelectorN} from "../gui/base/DropDownSelectorN"
import stream from "mithril/stream/stream.js"
import {isSameId} from "../api/common/EntityFunctions"

assertMainOrNode()

/**
 *  List that is rendered within the template Settings
 */

export class TemplateListView implements UpdatableSettingsViewer {
	_dialog: Dialog
	_list: ?List<EmailTemplate, TemplateRow>
	_listId: ?Id
	_settingsView: SettingsView
	_templateGroupMembership: GroupMembership
	_templateGroupRoot: ?TemplateGroupRoot
	_templateGroupModel: TemplateGroupModel
	_entityClient: EntityClient
	_selectedGroupRoot: Stream<?TemplateGroupRoot>


	constructor(settingsView: SettingsView, templateGroupModel: TemplateGroupModel, entityClient: EntityClient) {
		console.log("new template list viewer")
		this._settingsView = settingsView
		this._entityClient = entityClient
		this._templateGroupModel = templateGroupModel
		this._selectedGroupRoot = stream(null)
		this._listId = null
		templateGroupModel.init().then(templateGroupInstances => {
			this._selectedGroupRoot(templateGroupInstances[0].groupRoot)
		})
		this._selectedGroupRoot.map(newSelection => {
			if (newSelection) {
				this._updateTemplateList(newSelection)
			}
		})
	}

	_updateTemplateList(templateGroupRoot: TemplateGroupRoot) {
		const templateListId = templateGroupRoot.templates
		const listConfig: ListConfig<EmailTemplate, TemplateRow> = {
			rowHeight: size.list_row_height,
			fetch: (startId, count) => {
				console.log("template list fetch", startId, count)
				return this._entityClient.loadRange(EmailTemplateTypeRef, templateListId, startId, count, true)
			},
			loadSingle: (elementId) => {
				return this._entityClient.load(EmailTemplateTypeRef, [templateListId, elementId])
			},
			sortCompare: (a: EmailTemplate, b: EmailTemplate) => {
				var titleA = a.title.toUpperCase();
				var titleB = b.title.toUpperCase();
				return (titleA < titleB) ? -1 : (titleA > titleB) ? 1 : 0
			},
			elementSelected: (templates: Array<EmailTemplate>, elementClicked) => {
				if (elementClicked) {
					this._settingsView.detailsViewer = new TemplateDetailsViewer(templates[0], this._entityClient)
					this._settingsView.focusSettingsDetailsColumn()
				} else if (templates.length === 0 && this._settingsView.detailsViewer) {
					this._settingsView.detailsViewer = null
					m.redraw()
				}

			},
			createVirtualRow: () => {
				return new TemplateRow()
			},
			showStatus: false,
			className: "template-list",
			swipe: {
				renderLeftSpacer: () => [],
				renderRightSpacer: () => [],
				swipeLeft: (listElement) => Promise.resolve(),
				swipeRight: (listElement) => Promise.resolve(),
				enabled: false
			},
			elementsDraggable: false,
			multiSelectionAllowed: false,
			emptyMessage: lang.get("noEntries_msg"),
		}
		console.log("set new template list", templateGroupRoot._id)
		this._listId = templateListId
		this._list = new List(listConfig)
		this._list.loadInitial()
		m.redraw()
	}


	view(): Children {
		return m(".flex.flex-column.fill-absolute", [
			m(".flex.plr-l.list-border-right.list-bg.list-header",
				[
					m(".flex-grow.pb.pr", m(DropDownSelectorN, { // TODO: Remove border bottom
						label: () => "Select Group", //TODO TranslationKey
						items: this._templateGroupModel.getGroupInstances().map(templateGroupInstance => {
							return {
								name: templateGroupInstance.groupInfo.name,
								value: templateGroupInstance.groupRoot
							}
						}),
						selectedValue: this._selectedGroupRoot,
						class: "transparent-border",
					})),
					m(".mr-negative-s.align-self-end", m(ButtonN, {
						label: "addTemplate_label",
						type: ButtonType.Primary,
						click: () => {
							this._showDialogWindow()
						}
					}))
				]
			),
			m(".rel.flex-grow", this._list ? m(this._list) : null)
		])
	}


	_showDialogWindow(existingTitle?: string, existingID?: string, existingContent?: string, index?: number, allowCancel: boolean = true) {
		const selected = this._selectedGroupRoot()
		if (selected) {
			new TemplateEditor(null, selected.templates, neverNull(selected._ownerGroup), locator.entityClient)
		}
	}

	entityEventsReceived(updates: $ReadOnlyArray<EntityUpdateData>): Promise<void> {
		console.log("event update received", updates, "current listId", this._listId, this._selectedGroupRoot)
		return Promise.each(updates, update => {
			const list = this._list
			if (list && this._listId && isUpdateForTypeRef(EmailTemplateTypeRef, update) && isSameId(this._listId, update.instanceListId)) {
				console.log("list status", list)
				return list.entityEventReceived(update.instanceId, update.operation)
			}
		}).then(() => {
			this._settingsView.detailsViewer = null
			m.redraw()
		})
	}
}

export class TemplateRow {
	top: number;
	domElement: ?HTMLElement; // set from List
	entity: ?EmailTemplate;
	_domTemplateTitle: HTMLElement;
	_domTemplateId: HTMLElement;

	constructor() {
		this.top = 0 // is needed because of the list component
	}

	update(template: EmailTemplate, selected: boolean): void {
		if (!this.domElement) {
			return
		}
		if (selected) {
			this.domElement.classList.add("row-selected")
		} else {
			this.domElement.classList.remove("row-selected")
		}
		this._domTemplateTitle.textContent = template.title
		this._domTemplateId.textContent = template.tag ? template.tag : ""
	}


	render(): Children {
		return [
			m(".top", [
				m(".name.text-ellipsis", {oncreate: (vnode) => this._domTemplateTitle = vnode.dom}),
			]),
			m(".bottom.flex-space-between", [
				m("small.templateContent", {oncreate: (vnode) => this._domTemplateId = vnode.dom}),
			])
		]
	}

}





