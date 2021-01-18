// @flow

import {create, TypeRef} from "../../common/EntityFunctions"


export const TemplateGroupRootTypeRef: TypeRef<TemplateGroupRoot> = new TypeRef("tutanota", "TemplateGroupRoot")
export const _TypeModel: TypeModel = {
	"name": "TemplateGroupRoot",
	"since": 45,
	"type": "ELEMENT_TYPE",
	"id": 1180,
	"rootId": "CHR1dGFub3RhAASc",
	"versioned": false,
	"encrypted": true,
	"values": {
		"_format": {
			"name": "_format",
			"id": 1184,
			"since": 45,
			"type": "Number",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		},
		"_id": {
			"name": "_id",
			"id": 1182,
			"since": 45,
			"type": "GeneratedId",
			"cardinality": "One",
			"final": true,
			"encrypted": false
		},
		"_ownerEncSessionKey": {
			"name": "_ownerEncSessionKey",
			"id": 1186,
			"since": 45,
			"type": "Bytes",
			"cardinality": "ZeroOrOne",
			"final": true,
			"encrypted": false
		},
		"_ownerGroup": {
			"name": "_ownerGroup",
			"id": 1185,
			"since": 45,
			"type": "GeneratedId",
			"cardinality": "ZeroOrOne",
			"final": true,
			"encrypted": false
		},
		"_permissions": {
			"name": "_permissions",
			"id": 1183,
			"since": 45,
			"type": "GeneratedId",
			"cardinality": "One",
			"final": true,
			"encrypted": false
		}
	},
	"associations": {
		"knowledgeBase": {
			"name": "knowledgeBase",
			"id": 1188,
			"since": 45,
			"type": "LIST_ASSOCIATION",
			"cardinality": "One",
			"refType": "KnowledgeBaseEntry",
			"final": true,
			"external": false
		},
		"templates": {
			"name": "templates",
			"id": 1187,
			"since": 45,
			"type": "LIST_ASSOCIATION",
			"cardinality": "One",
			"refType": "EmailTemplate",
			"final": true,
			"external": false
		}
	},
	"app": "tutanota",
	"version": "45"
}

export function createTemplateGroupRoot(values?: $Shape<$Exact<TemplateGroupRoot>>): TemplateGroupRoot {
	return Object.assign(create(_TypeModel, TemplateGroupRootTypeRef), values)
}

export type TemplateGroupRoot = {
	_type: TypeRef<TemplateGroupRoot>;
	_errors: Object;

	_format: NumberString;
	_id: Id;
	_ownerEncSessionKey: ?Uint8Array;
	_ownerGroup: ?Id;
	_permissions: Id;

	knowledgeBase: Id;
	templates: Id;
}