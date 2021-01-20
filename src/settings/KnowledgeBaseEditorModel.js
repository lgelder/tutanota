// @flow

import type {KnowledgeBaseEntryKeywords} from "../api/entities/tutanota/KnowledgeBaseEntryKeywords"
import {createKnowledgeBaseEntryKeywords} from "../api/entities/tutanota/KnowledgeBaseEntryKeywords"
import type {EmailTemplate} from "../api/entities/tutanota/EmailTemplate"
import {remove} from "../api/common/utils/ArrayUtils"
import {TemplateModel} from "../templates/TemplateModel"

/**
 *  Model, which includes the logic of the editor
 */

export class KnowledgeBaseEditorModel {
	_addedKeywords: Array<KnowledgeBaseEntryKeywords>
	_templateModel: TemplateModel

	constructor(templateModel: TemplateModel) {
		this._addedKeywords = []
		this._templateModel = templateModel
	}

	initAddedKeywords(keywords: Array<KnowledgeBaseEntryKeywords>) {
		this._addedKeywords.push(...keywords)
	}

	getAvailableTemplates(): Array<EmailTemplate> {
		return this._templateModel.getAllTemplates()
	}

	getAddedKeywords(): Array<KnowledgeBaseEntryKeywords> {
		return this._addedKeywords
	}

	addKeyword(keywordInput: string) {
		let keyword
		const keywordString = keywordInput.toLowerCase().replace(/\s/g, "")
		if (keywordString !== "") {
			keyword = createKnowledgeBaseEntryKeywords({keyword: keywordString})
			if (!this.hasKeyword(keyword)) {
				this._addedKeywords.push(keyword)
			}
		}
	}

	removeKeyword(keyword: KnowledgeBaseEntryKeywords) {
		remove(this._addedKeywords, keyword)
	}

	hasKeyword(currentKeyword: KnowledgeBaseEntryKeywords): boolean {
		return this._addedKeywords.some(keyword => {
			return currentKeyword.keyword === keyword.keyword
		})
	}

}