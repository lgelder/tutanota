// @flow

import m from "mithril"
import type {KnowledgeBaseEntry} from "../api/entities/tutanota/KnowledgeBaseEntry"
import {EntityClient} from "../api/common/EntityClient"
import {createKnowledgeBaseEntry} from "../api/entities/tutanota/KnowledgeBaseEntry"
import stream from "mithril/stream/stream.js"
import {HtmlEditor} from "../gui/base/HtmlEditor"
import type {TextFieldAttrs} from "../gui/base/TextFieldN"
import {ButtonColors, ButtonN, ButtonType} from "../gui/base/ButtonN"
import type {ButtonAttrs} from "../gui/base/ButtonN"
import {Icons} from "../gui/base/icons/Icons"
import {KnowledgeBaseEditorModel} from "./KnowledgeBaseEditorModel"
import {clone, neverNull, noOp} from "../api/common/utils/Utils"
import {TextFieldN} from "../gui/base/TextFieldN"
import type {EmailTemplate} from "../api/entities/tutanota/EmailTemplate"
import {Dialog} from "../gui/base/Dialog"
import type {DialogHeaderBarAttrs} from "../gui/base/DialogHeaderBar"
import {lang} from "../misc/LanguageViewModel"
import {NotFoundError} from "../api/common/error/RestError"
import {px} from "../gui/size"
import type {KeyPress} from "../misc/KeyManager"
import {Keys} from "../api/common/TutanotaConstants"
import {DropDownSelectorN} from "../gui/base/DropDownSelectorN"
import {elementIdPart, listIdPart} from "../api/common/EntityFunctions"
import {Icon} from "../gui/base/Icon"
import {locator} from "../api/main/MainLocator"

/**
 *  Editor to edit / add a knowledgebase entry
 */

export class KnowledgeBaseEditor {
	_editorModel: KnowledgeBaseEditorModel
	entry: KnowledgeBaseEntry
	_entryTitle: Stream<string>
	_entryKeyword: Stream<string>
	_selectedTemplate: Stream<?EmailTemplate>
	_dialog: Dialog
	_entryContentEditor: HtmlEditor
	view: Function
	+_entityClient: EntityClient
	+_entryListId: Id
	+_ownerGroup: Id

	constructor(entry: ?KnowledgeBaseEntry, entryListId: Id, ownerGroup: Id, entityClient: EntityClient) {
		this._editorModel = new KnowledgeBaseEditorModel(locator.templateModel)
		this.entry = entry ? clone(entry) : createKnowledgeBaseEntry()

		this._entryTitle = stream("")
		this._entryKeyword = stream("")
		this._selectedTemplate = stream( null)
		this._entityClient = entityClient
		this._entryListId = entryListId
		this._ownerGroup = ownerGroup

		this._entryContentEditor = new HtmlEditor("content_label", {enabled: true}, () => this._renderTemplateLinkButton())
			.showBorders()
			.setMinHeight(500)

		this._initValues()

		const titleAttrs: TextFieldAttrs = {
			label: "title_label",
			value: this._entryTitle
		}

		const addKeywordAttrs: ButtonAttrs = {
			label: "addKeyword_action",
			type: ButtonType.Action,
			click: () => {
				this._editorModel.addKeyword(this._entryKeyword())
				this._entryKeyword("")
			},
			icon: () => Icons.Add
		}

		const keywordAttrs: TextFieldAttrs = {
			label: "keywords_label",
			value: this._entryKeyword,
			injectionsRight: () => m(ButtonN, addKeywordAttrs),
			keyHandler: (key: KeyPress) => {
				if (key.keyCode === Keys.RETURN.code) {
					this._editorModel.addKeyword(this._entryKeyword())
					this._entryKeyword("")
					return false
				}
				return true
			}
		}

		this.view = () => {
			return m("", [
				m(TextFieldN, titleAttrs),
				m(TextFieldN, keywordAttrs),
				m(".editor-border.flex.wrap.scroll-y", {
					style: {
						width: px(760),
						height: px(100),
					}
				}, [
					this._editorModel.getAddedKeywords().map(keyword => {
						return m(".flex.flex-row.bubbleTag.plr-button.pl-s.pr-s.border-radius.no-wrap.mr-s.min-content", [
							m(".text-ellipsis", keyword.keyword),
							m(".flex.click.center-vertically", {onclick: () => this._editorModel.removeKeyword(keyword)},
								m(Icon, {
									icon: Icons.Cancel,
								})
							)
						])
					})
				]),
				m(this._entryContentEditor),
			])
		}

		let dialogCloseAction = () => {
			this._close()
		}

		let headerBarAttrs: DialogHeaderBarAttrs = {
			left: [{label: 'cancel_action', click: dialogCloseAction, type: ButtonType.Secondary}],
			right: [{label: 'save_action', click: () => this._save(), type: ButtonType.Primary}],
			middle: () => lang.get(this.entry._id ? "editEntry_label" : "createEntry_action")
		}
		this._dialog = Dialog.largeDialog(headerBarAttrs, this)
		this._dialog.show()

	}

	_renderTemplateLinkButton(): Children {
		return m(ButtonN, {
			label: "emptyString_msg",
			title: () => "link template",
			click: () => {
				this._renderTemplateDialog()
			},
			type: ButtonType.Toggle,
			icon: () => Icons.Add,
			colors: ButtonColors.Elevated,
		})
	}

	_renderTemplateDialog() {
		const templates = this._editorModel.getAvailableTemplates()
		this._selectedTemplate(templates ? templates[0] : null)
		const submitTemplateAction = (dialog) => {
			const template = this._selectedTemplate()
			if (template) {
				this._entryContentEditor._editor.insertHTML(`<a href="tutatemplate:${listIdPart(template._id)}/${elementIdPart(template._id)}" >#${template.tag}</a> `)
			}
			dialog.close()
			m.redraw()
		}
		Dialog.showActionDialog({
			title: () => "Choose template", // TODO: TranslationKey
			child: {
				view: () => m(DropDownSelectorN, {
					label: () => "Choose Template", // TODO: TranslationKey
					items: this._editorModel.getAvailableTemplates().map(template => {
						return {
							name: template.tag,
							value: template,
						}
					}),
					selectedValue: this._selectedTemplate
				})
			},
			allowOkWithReturn: true,
			okAction: submitTemplateAction
		})
	}

	_initValues() {
		if (this.entry._id) { // if existing entry
			// init existing keywords, steps and title
			this._entryTitle(this.entry.title)
			this._editorModel.initAddedKeywords(this.entry.keywords)

			const content = this.entry.description
			this._entryContentEditor.setValue(content)

		}
	}

	_save() {
		// check for empty content
		if (!this._entryTitle()) {
			Dialog.error("emptyTitle_msg")
			return
		}
		if (!this._entryContentEditor.getValue()) {
			Dialog.error("emptyUseCase_msg")
			return
		}
		this.entry.title = this._entryTitle()
		this.entry.keywords = this._editorModel.getAddedKeywords()
		this.entry.description = this._entryContentEditor.getValue()

		let promise
		if (this.entry._id) {
			promise = this._entityClient.update(this.entry)
			              .catch(NotFoundError, noOp)
		} else {
			// set ownerGroup
			this.entry._ownerGroup = neverNull(this._ownerGroup)
			promise = this._entityClient.setup(this._entryListId, this.entry).then(entryId => {
				console.log("success entry created" + entryId)
			})
		}
		promise.then(() => {
			this._close()
		})
	}

	_close(): void {
		this._dialog.close()
	}
}