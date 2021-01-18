// @flow

import {create, TypeRef} from "../../common/EntityFunctions"


export const KnowledgeBaseEntryKeywordsTypeRef: TypeRef<KnowledgeBaseEntryKeywords> = new TypeRef("tutanota", "KnowledgeBaseEntryKeywords")
export const _TypeModel: TypeModel = {
	"name": "KnowledgeBaseEntryKeywords",
	"since": 45,
	"type": "AGGREGATED_TYPE",
	"id": 1167,
	"rootId": "CHR1dGFub3RhAASP",
	"versioned": false,
	"encrypted": false,
	"values": {
		"_id": {
			"name": "_id",
			"id": 1168,
			"since": 45,
			"type": "CustomId",
			"cardinality": "One",
			"final": true,
			"encrypted": false
		},
		"keyword": {
			"name": "keyword",
			"id": 1169,
			"since": 45,
			"type": "String",
			"cardinality": "One",
			"final": false,
			"encrypted": true
		}
	},
	"associations": {},
	"app": "tutanota",
	"version": "45"
}

export function createKnowledgeBaseEntryKeywords(values?: $Shape<$Exact<KnowledgeBaseEntryKeywords>>): KnowledgeBaseEntryKeywords {
	return Object.assign(create(_TypeModel, KnowledgeBaseEntryKeywordsTypeRef), values)
}

export type KnowledgeBaseEntryKeywords = {
	_type: TypeRef<KnowledgeBaseEntryKeywords>;

	_id: Id;
	keyword: string;
}