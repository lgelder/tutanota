//@flow
import type {LanguageCode} from "../misc/LanguageViewModel"
import {lang} from "../misc/LanguageViewModel"
import {searchInTemplates} from "./TemplateSearchFilter"
import {downcast, neverNull} from "../api/common/utils/Utils"
import type {NavAction} from "./TemplatePopup"
import {SELECT_NEXT_TEMPLATE} from "./TemplatePopup"
import type {EmailTemplate} from "../api/entities/tutanota/EmailTemplate"
import {EmailTemplateTypeRef} from "../api/entities/tutanota/EmailTemplate"
import type {EntityEventsListener} from "../api/main/EventController"
import {EventController, isUpdateForTypeRef} from "../api/main/EventController"
import {getElementId, isSameId} from "../api/common/EntityFunctions"
import {findAndRemove} from "../api/common/utils/ArrayUtils"
import {OperationType} from "../api/common/TutanotaConstants"
import stream from "mithril/stream/stream.js"
import {EntityClient} from "../api/common/EntityClient"
import type {LoginController} from "../api/main/LoginController"
import {TemplateGroupRootTypeRef} from "../api/entities/tutanota/TemplateGroupRoot"
import {LazyLoaded} from "../api/common/utils/LazyLoaded"
import type {TemplateGroupRoot} from "../api/entities/tutanota/TemplateGroupRoot"

/**
 *   Model that holds main logic for the Template Feature.
 *   Handles things like returning the selected Template, selecting Templates, indexes, scrolling.
 */

export class TemplateModel {
	_allTemplates: Array<EmailTemplate>
	_searchResults: Stream<Array<EmailTemplate>>
	_selectedTemplate: ?EmailTemplate
	_selectedLanguage: LanguageCode
	_templateListId: Id
	_hasLoaded: boolean
	+_eventController: EventController;
	+_entityEventReceived: EntityEventsListener;
	+_logins: LoginController;
	+_entityClient: EntityClient;
	_templateGroupRoot: ?TemplateGroupRoot

	constructor(eventController: EventController, logins: LoginController, entityClient: EntityClient) {
		this._eventController = eventController
		this._logins = logins
		this._entityClient = entityClient
		this._selectedLanguage = downcast(lang.code)
		this._allTemplates = []
		this._searchResults = stream([])
		this._selectedTemplate = null
		this._hasLoaded = false
		this._templateGroupRoot = null

		this._entityEventReceived = (updates) => {
			return Promise.each(updates, update => {
				if (isUpdateForTypeRef(EmailTemplateTypeRef, update)) {
					if (update.operation === OperationType.CREATE) {
						return this._getTemplateListId().then((listId) => {
							if (listId && listId === update.instanceListId) {
								return this._entityClient.load(EmailTemplateTypeRef, [listId, update.instanceId])
								           .then((template) => {
									           this._allTemplates.push(template)
									           this._searchResults(this._allTemplates)
								           })
							}
						})
					} else if (update.operation === OperationType.UPDATE) {
						return this._getTemplateListId().then((listId) => {
							if (listId && listId === update.instanceListId) {
								return this._entityClient.load(EmailTemplateTypeRef, [listId, update.instanceId])
								           .then((template) => {
									           findAndRemove(this._allTemplates, (t) => isSameId(getElementId(t), update.instanceId))
									           this._allTemplates.push(template)
									           this._searchResults(this._allTemplates)
								           })
							}
						})
					} else if (update.operation === OperationType.DELETE) {
						return this._getTemplateListId().then((listId) => {
							if (listId && listId === update.instanceListId) {
								findAndRemove(this._allTemplates, (t) => isSameId(getElementId(t), update.instanceId))
								this._searchResults(this._allTemplates)
							}
						})
					}
				}
			}).return()
		}
		this._eventController.addEntityListener(this._entityEventReceived)
	}

	init(): Promise<void> {
		return this.loadTemplates().then(templates => {
			this._allTemplates = templates
			this._searchResults(this._allTemplates)
			this._hasLoaded = true
			this.setSelectedTemplate(this.containsResult() ? this._searchResults()[0] : null) // needs to be called, because otherwise the selection would be null, even when templates are loaded. (fixes bug)
		})
	}

	search(input: string): void {
		if (input === "") {
			this._searchResults(this._allTemplates)
		} else {
			this._searchResults(searchInTemplates(input, this._allTemplates))
		}
		this.setSelectedTemplate(this.containsResult() ? this._searchResults()[0] : null)
	}

	containsResult(): boolean {
		return this._searchResults().length > 0
	}

	isSelectedTemplate(template: EmailTemplate): boolean {
		return (this._selectedTemplate === template)
	}

	_updateSelectedLanguage() {
		if (this._selectedTemplate && this._searchResults().length) {
			let clientLanguage = lang.code
			this._selectedLanguage = this._isLanguageInContent(clientLanguage) ? clientLanguage : downcast(neverNull(this._selectedTemplate).contents[0].languageCode)
		}
	}

	getSearchResults(): Stream<Array<EmailTemplate>> {
		return this._searchResults
	}

	getSelectedLanguage(): LanguageCode {
		return this._selectedLanguage
	}

	getSelectedTemplate(): ?EmailTemplate {
		return this._selectedTemplate
	}

	hasLoaded(): boolean {
		return this._hasLoaded
	}

	getSelectedTemplateIndex(): number {
		return this._searchResults().indexOf(this._selectedTemplate)
	}

	setSelectedLanguage(lang: LanguageCode) { // call function to globally set a language
		this._selectedLanguage = lang
	}

	setSelectedTemplate(template: ?EmailTemplate) { // call function to globally set a Template
		this._selectedTemplate = template
		this._updateSelectedLanguage()
	}

	selectNextTemplate(action: NavAction): boolean { // returns true if selection is changed
		const selectedIndex = this.getSelectedTemplateIndex()
		const nextIndex = selectedIndex + (action === SELECT_NEXT_TEMPLATE ? 1 : -1)
		if (nextIndex >= 0 && nextIndex < this._searchResults().length) {
			const nextSelectedTemplate = this._searchResults()[nextIndex]
			this.setSelectedTemplate(nextSelectedTemplate)
			return true
		}
		return false
	}

	dispose() {
		this._eventController.removeEntityListener(this._entityEventReceived)
	}

	_chooseLanguage(language: LanguageCode) {
		this._selectedLanguage = this._isLanguageInContent(language) ? language : downcast(neverNull(this._selectedTemplate).contents[0].languageCode)
	}

	_isLanguageInContent(languageCode: LanguageCode): boolean { // returns true if passed language is within the contents of the currently selected Template
		if (this._selectedTemplate) {
			for (const templateContent of this._selectedTemplate.contents) {
				if (templateContent.languageCode === languageCode) {
					return true
				}
			}
		}
		return false
	}

	getContentFromLanguage(languageCode: LanguageCode): string { // returns the value of the content as string
		if (this._selectedTemplate) {
			for (const content of this._selectedTemplate.contents) {
				if (content.languageCode === languageCode) {
					return content.text
				}
			}
		}
		return ""
	}

	loadTemplates(): Promise<Array<EmailTemplate>> {
		return this._getTemplateListId().then((listId) => {
			if (listId) {
				return this._entityClient.loadAll(EmailTemplateTypeRef, listId)
			} else {
				return []
			}
		})
	}

	_getTemplateListId(): Promise<?Id> {
		if (this._templateGroupRoot) {
			return Promise.resolve(this._templateGroupRoot.templates)
		}
		if (this._logins.isInternalUserLoggedIn()) {
			const memberships = this._logins.getUserController().getTemplateMemberships()
			const templateGroupMembership = memberships[0]
			if (templateGroupMembership) {
				return this._entityClient.load(TemplateGroupRootTypeRef, templateGroupMembership.group)
				           .then(templateGroupRoot => {
					           this._templateGroupRoot = templateGroupRoot
					           templateGroupRoot.templates
				           });

			}
		}
		return Promise.resolve(null);
	}

	getTemplateGroupRoot(): ?TemplateGroupRoot {
		return this._templateGroupRoot
	}
}


