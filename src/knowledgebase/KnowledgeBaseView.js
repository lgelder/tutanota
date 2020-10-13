// @flow
import m from "mithril"
import {px} from "../gui/size"
import {knowledgebase} from "./KnowledgeBaseModel"
import {theme} from "../gui/theme"
import {Icons} from "../gui/base/icons/Icons"
import type {KnowledgeBaseEntry} from "../api/entities/tutanota/KnowledgeBaseEntry"
import {KnowledgeBaseListEntry} from "./KnowledgeBaseListEntry"
import {lang} from "../misc/LanguageViewModel"
import type {TextFieldAttrs} from "../gui/base/TextFieldN"
import {TextFieldN} from "../gui/base/TextFieldN"
import type {ButtonAttrs} from "../gui/base/ButtonN"
import {ButtonColors, ButtonN, ButtonType} from "../gui/base/ButtonN"
import stream from "mithril/stream/stream.js"
import {Dialog} from "../gui/base/Dialog"
import {DropDownSelectorN} from "../gui/base/DropDownSelectorN"
import {KnowledgeBaseEntryView} from "./KnowledgeBaseEntryView"
import {BootIcons} from "../gui/base/icons/BootIcons"
import {locator} from "../api/main/MainLocator"
import {KnowledgeBaseEditor} from "../settings/KnowledgeBaseEditor"
import {lastThrow} from "../api/common/utils/ArrayUtils"
import type {EmailTemplate} from "../api/entities/tutanota/EmailTemplate"
import {KnowledgeBaseTemplateView} from "./KnowledgeBaseTemplateView"
import type {LanguageCode} from "../misc/LanguageViewModel"
import {getListId, isSameId} from "../api/common/EntityFunctions"
import {neverNull} from "../api/common/utils/Utils"
import {DialogHeaderBar} from "../gui/base/DialogHeaderBar"

type KnowledgebaseViewAttrs = {
	onSubmit: (string) => void,
}

export const KNOWLEDGEBASE_PANEL_HEIGHT = 840;
export const KNOWLEDGEBASE_PANEL_WIDTH = 500;//575;
export const KNOWLEDGEBASE_PANEL_TOP = 120;

type TemplatePage = {
	type: "template",
	template: IdTuple,
	language: LanguageCode,
	fetchedTemplate: ?EmailTemplate
}

export type Page =
	| {type: "list"}
	| {type: "entry", entry: IdTuple}
	| TemplatePage

/**
 *  Renders the SearchBar and the pages (list, entry, template) of the knowledgebase besides the MailEditor
 */

export class KnowledgeBaseView implements MComponent<KnowledgebaseViewAttrs> {
	_searchbarValue: Stream<string>
	_redrawStream: Stream<*>
	_pages: Stream<Array<Page>>;

	constructor({attrs}: Vnode<KnowledgebaseViewAttrs>) {
		this._searchbarValue = stream("")
		this._pages = stream([{type: "list"}])
	}


	oncreate() {
		this._redrawStream = stream.combine(() => {
			m.redraw()
		}, [knowledgebase.selectedEntry, knowledgebase.filteredEntries])
	}

	onremove() {
		if (this._redrawStream) {
			this._redrawStream.end(true)
		}
	}

	view({attrs}: Vnode<KnowledgebaseViewAttrs>): Children {
		return m(".flex.flex-column.abs.elevated-bg", {
			style: {
				height: px(KNOWLEDGEBASE_PANEL_HEIGHT),
				width: px(KNOWLEDGEBASE_PANEL_WIDTH),
				top: px(KNOWLEDGEBASE_PANEL_TOP),
			}
		}, [this._renderHeader(attrs), m(".mr-s.ml-s", this._renderCurrentPageContent())])
	}

	_renderCurrentPageContent(): Children {
		const currentPage = lastThrow(this._pages())
		switch (currentPage.type) {
			case "list":
				return [this._renderSearchBar(), this._renderKeywords(), this._renderList()]
			case "entry":
				const entry = knowledgebase.selectedEntry() // this._selectedEntryStream()
				if (!entry) return null
				return m(KnowledgeBaseEntryView, {
					entry: entry,
					onTemplateSelected: (template) => {
						const templatePage: TemplatePage = {
							type: "template",
							template,
							language: lang.code,
							fetchedTemplate: null
						}
						knowledgebase.loadTemplate(template).then((fetchedTemplate) => {
							templatePage.fetchedTemplate = fetchedTemplate
							templatePage.language = knowledgebase.getLanguageFromTemplate(fetchedTemplate)
							m.redraw()
						})
						this._pages(this._pages().concat(templatePage))
					},
				})
			case "template":
				return m(KnowledgeBaseTemplateView, {
					language: currentPage.language,
					onLanguageSelected: (language) => currentPage.language = language,
					fetchedTemplate: currentPage.fetchedTemplate
				})
			default:
				throw new Error("stub")
		}
	}

	_renderHeader(attrs: KnowledgebaseViewAttrs): Children {
		const currentPage = lastThrow(this._pages())
		switch (currentPage.type) {
			case "list":
				return m(".pl", renderHeaderBar(lang.get("knowledgebase_label"), {
					label: "close_alt",
					click: () => {
						knowledgebase.close()
					},
					type: ButtonType.Secondary,
				}, {
					label: "addEntry_label",
					click: () => {
						this._showDialogWindow()
					},
					type: ButtonType.Primary,
				}))
			case "entry":
				const entry = knowledgebase.selectedEntry() // this._selectedEntryStream()
				if (!entry) return null
				return renderHeaderBar(entry.title, {
					label: "back_action",
					click: () => this._removeLastPage(),
					icon: () => Icons.ArrowBackward,
					colors: ButtonColors.DrawerNav,
					type: ButtonType.ActionLarge
				}, {
					label: "editEntry_label",
					click: () => {
						new KnowledgeBaseEditor(entry, getListId(entry), neverNull(entry._ownerGroup), locator.entityClient)
					},
					type: ButtonType.Primary
				})
			case "template":
				const title = currentPage.fetchedTemplate ? currentPage.fetchedTemplate.title : lang.get("loading_msg")
				return renderHeaderBar(title, {
					label: "back_action",
					click: () => this._removeLastPage(),
					icon: () => Icons.ArrowBackward,
					colors: ButtonColors.DrawerNav,
					type: ButtonType.ActionLarge
				}, {
					label: "submit_label",
					click: () => {
						attrs.onSubmit(knowledgebase.getContentFromTemplate(currentPage.language, currentPage.fetchedTemplate))
						this._removeLastPage()
					},
					type: ButtonType.Primary
				})
			default:
				throw new Error("stub")

		}
	}

	_renderSearchBar(): Children {
		const searchBarAttrs: TextFieldAttrs = {
			label: "filter_label",
			value: this._searchbarValue,
			oninput: (input) => {
				knowledgebase.filter(input)
			}
		}
		return m(TextFieldN, searchBarAttrs)
	}

	_renderKeywords(): Children {
		const matchedKeywords = knowledgebase.getMatchedKeywordsInContent()
		return m(".flex.mt-s.wrap", [
			matchedKeywords.length > 0
				? m(".small.full-width", lang.get("matchingKeywords_label"))
				: null,
			matchedKeywords.map(keyword => {
				return m(".bubbleTag-no-padding.plr-button.pl-s.pr-s.border-radius.no-wrap.mr-s.min-content", keyword)
			})
		])
	}

	_renderList(): Children {
		return m(".mt-s.scroll", [
			knowledgebase.containsResult()
				? knowledgebase.filteredEntries().map((entry, index) => this._renderListEntry(entry, index))
				: m(".center", lang.get("noEntryFound_label"))
		])
	}

	_renderListEntry(entry: KnowledgeBaseEntry, index: number): Children {
		return m(".flex.flex-column", [
			m(".flex.template-list-row.click", {
				style: {
					backgroundColor: (index % 2) ? theme.list_bg : theme.list_alternate_bg
				},
				onclick: () => {
					knowledgebase.selectedEntry(entry)
					this._pages(this._pages().concat({type: "entry", entry: entry._id}))
				}
			}, [
				m(KnowledgeBaseListEntry, {entry: entry}),
			])
		])
	}

	_removeLastPage() {
		this._pages(this._pages().slice(0, -1))
	}

	_showDialogWindow() {
		locator.mailModel.getUserMailboxDetails().then(details => {
			if (details.mailbox.knowledgeBase && details.mailbox._ownerGroup) {
				new KnowledgeBaseEditor(null, details.mailbox.knowledgeBase.list, details.mailbox._ownerGroup, locator.entityClient)
			}
		})
	}
}

export function renderHeaderBar(title: string, leftButtonAttrs?: ButtonAttrs, rightButtonAttrs?: ButtonAttrs): Children {
	return m(".pr", m(DialogHeaderBar, { // padding right because otherwise the right button would be directly on the edge
		middle: () => title,
		left: leftButtonAttrs
			? [leftButtonAttrs]
			: [],
		right: rightButtonAttrs
			? [rightButtonAttrs]
			: []
	}))

}

