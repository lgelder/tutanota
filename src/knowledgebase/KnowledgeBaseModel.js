//@flow
import type {KnowledgeBaseEntry} from "../api/entities/tutanota/KnowledgeBaseEntry"
import type {EmailTemplate} from "../api/entities/tutanota/EmailTemplate"
import {EventController, isUpdateForTypeRef} from "../api/main/EventController"
import type {EntityEventsListener, EntityUpdateData} from "../api/main/EventController"
import {MailModel} from "../mail/MailModel"
import {EntityClient} from "../api/common/EntityClient"
import {locator} from "../api/main/MainLocator"
import {KnowledgeBaseEntryTypeRef} from "../api/entities/tutanota/KnowledgeBaseEntry"
import {knowledgeBaseSearch} from "./KnowledgeBaseSearchFilter"
import type {LanguageCode} from "../misc/LanguageViewModel"
import stream from "mithril/stream/stream.js"
import {getElementId, isSameId} from "../api/common/EntityFunctions"
import {findAndRemove} from "../api/common/utils/ArrayUtils"
import {OperationType} from "../api/common/TutanotaConstants"
import {EmailTemplateTypeRef} from "../api/entities/tutanota/EmailTemplate"
import {htmlSanitizer} from "../misc/HtmlSanitizer"
import {lang} from "../misc/LanguageViewModel"
import {downcast} from "../api/common/utils/Utils"
import type {LoginController} from "../api/main/LoginController"
import {TemplateGroupRootTypeRef} from "../api/entities/tutanota/TemplateGroupRoot"
import type {TemplateGroupRoot} from "../api/entities/tutanota/TemplateGroupRoot"

/**
 *   Model that holds main logic for the Knowdledgebase.
 */
export class KnowledgeBaseModel {
	_allEntries: Array<KnowledgeBaseEntry>
	filteredEntries: Stream<Array<KnowledgeBaseEntry>>
	selectedEntry: Stream<?KnowledgeBaseEntry>
	_allKeywords: Array<string>
	_matchedKeywordsInContent: Array<?string>
	_isActive: boolean
	_filterValue: string
	+_eventController: EventController;
	+_entityEventReceived: EntityEventsListener;
	+_logins: LoginController;
	+_entityClient: EntityClient;
	_templateGroupRoot: ?TemplateGroupRoot


	constructor(eventController: EventController, logins: LoginController, entityClient: EntityClient) {
		this._eventController = eventController
		this._logins = logins
		this._entityClient = entityClient
		this._allEntries = []
		this._allKeywords = []
		this._matchedKeywordsInContent = []
		this.filteredEntries = stream(this._allEntries)
		this.selectedEntry = stream(null)
		this._isActive = false
		this._filterValue = ""
		this._entityEventReceived = (updates) => {
			return this._entityUpdate(updates)
		}
		this._eventController.addEntityListener(this._entityEventReceived)
	}

	init(): Promise<void> {
		return this._loadEntries().then(entries => {
			this._allEntries = entries
			this.initAllKeywords()
			this.filteredEntries(this._allEntries)
		})
	}

	initAllKeywords() {
		this._allKeywords = []
		for (const entry of this._allEntries) {
			for (const keyword of entry.keywords) {
				if (!this._allKeywords.includes(keyword.keyword)) {
					this._allKeywords.push(keyword.keyword)
				}
			}
		}
	}

	containsResult(): boolean {
		return this.filteredEntries().length > 0
	}

	setActive() {
		this._isActive = true
	}

	getStatus(): boolean {
		return this._isActive
	}

	getAllKeywords(): Array<string> {
		return this._allKeywords.sort()
	}

	getMatchedKeywordsInContent(): Array<?string> {
		return this._matchedKeywordsInContent
	}

	getLanguageFromTemplate(template: EmailTemplate): LanguageCode {
		const clientLanguage = lang.code
		const hasClientLanguage = template.contents.some(
			(content) => content.languageCode === clientLanguage
		)
		if (hasClientLanguage) {
			return clientLanguage
		}
		return downcast(template.contents[0].languageCode)
	}

	getContentFromTemplate(languageCode: LanguageCode, template: ?EmailTemplate): string { // returns the value of the content as string
		const content = template && template.contents.find(c => c.languageCode === languageCode)
		const text = content && content.text || ""
		return htmlSanitizer.sanitize(text, true).text
	}

	sortEntriesByMatchingKeywords(emailContent: string) {
		this._matchedKeywordsInContent = []
		const emailContentNoTags = emailContent.replace(/(<([^>]+)>)/ig, "") // remove all html tags
		this._allKeywords.forEach(keyword => {
			if (emailContentNoTags.includes(keyword)) {
				this._matchedKeywordsInContent.push(keyword)
			}
		})
		this._sortEntries(this._allEntries)
		this._filterValue = ""
		this.filteredEntries(this._allEntries)
	}

	_sortEntries(entries: Array<KnowledgeBaseEntry>): void {
		entries.sort((a, b) => {
			return this._getMatchedKeywordsNumber(b) - this._getMatchedKeywordsNumber(a)
		})
	}

	_getMatchedKeywordsNumber(entry: KnowledgeBaseEntry): number {
		let matches = 0
		entry.keywords.forEach(k => {
			if (this._matchedKeywordsInContent.includes(k.keyword)) {
				matches++
			}
		})
		return matches
	}

	filter(input: string): void {
		this._filterValue = input
		const inputTrimmed = input.trim()
		if (inputTrimmed) {
			this.filteredEntries(knowledgeBaseSearch(inputTrimmed, this._allEntries))
		} else {
			this.filteredEntries(this._allEntries)
		}
	}

	_removeFromAllKeywords(keyword: string) {
		const index = this._allKeywords.indexOf(keyword)
		if (index > -1) {
			this._allKeywords.splice(index, 1)
		}
	}

	_getKnowledgeBaseListId(): Promise<?Id> {
		const templateGroupMembership = this._logins.getUserController().getTemplateMemberships()[0]
		if (this._templateGroupRoot) {
			return Promise.resolve(this._templateGroupRoot.knowledgeBase)
		}
		if (templateGroupMembership) {
			return this._entityClient.load(TemplateGroupRootTypeRef, templateGroupMembership.group)
			           .then(templateGroupRoot => {
				           this._templateGroupRoot = templateGroupRoot
				           return templateGroupRoot.knowledgeBase
			           })
		}
		return Promise.resolve(null)

	}

	dispose() {
		this._eventController.removeEntityListener(this._entityEventReceived)
	}

	close() {
		this._isActive = false
	}

	loadTemplate(templateId: IdTuple): Promise<EmailTemplate> {
		return this._entityClient.load(EmailTemplateTypeRef, templateId)
	}

	_loadEntries(): Promise<Array<KnowledgeBaseEntry>> {
		return this._getKnowledgeBaseListId().then((listId) => {
			if (listId) {
				return this._entityClient.loadAll(KnowledgeBaseEntryTypeRef, listId)
			} else {
				return []
			}
		})
	}

	_entityUpdate(updates: $ReadOnlyArray<EntityUpdateData>): Promise<void> {
		return Promise.each(updates, update => {
			if (isUpdateForTypeRef(KnowledgeBaseEntryTypeRef, update)) {
				if (update.operation === OperationType.CREATE) {
					return this._getKnowledgeBaseListId().then((listId) => {
						if (listId && listId === update.instanceListId) {
							return this._entityClient.load(KnowledgeBaseEntryTypeRef, [listId, update.instanceId])
							           .then((entry) => {
								           this._allEntries.push(entry)
								           this._sortEntries(this._allEntries)
								           this.filter(this._filterValue)
							           })
						}
					})
				} else if (update.operation === OperationType.UPDATE) {
					return this._getKnowledgeBaseListId().then((listId) => {
						if (listId && listId === update.instanceListId) {
							return this._entityClient.load(KnowledgeBaseEntryTypeRef, [listId, update.instanceId])
							           .then((updatedEntry) => {
								           findAndRemove(this._allEntries, (e) => isSameId(getElementId(e), update.instanceId))
								           this._allEntries.push(updatedEntry)
								           this._sortEntries(this._allEntries)
								           this.filter(this._filterValue)
								           const oldSelectedEntry = this.selectedEntry()
								           if (oldSelectedEntry && isSameId(oldSelectedEntry._id, updatedEntry._id)) {
									           this.selectedEntry(updatedEntry)
								           }
							           })
						}
					})
				} else if (update.operation === OperationType.DELETE) {
					return this._getKnowledgeBaseListId().then((listId) => {
						if (listId && listId === update.instanceListId) {
							findAndRemove(this._allEntries, (e) => isSameId(getElementId(e), update.instanceId))
							this.filter(this._filterValue)
						}
					})
				}
			}
		}).return()
	}
}

