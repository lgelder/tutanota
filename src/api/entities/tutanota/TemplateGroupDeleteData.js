// @flow

import {create, TypeRef} from "../../common/EntityFunctions"


export const TemplateGroupDeleteDataTypeRef: TypeRef<TemplateGroupDeleteData> = new TypeRef("tutanota", "TemplateGroupDeleteData")
export const _TypeModel: TypeModel = {
	"name": "TemplateGroupDeleteData",
	"since": 45,
	"type": "DATA_TRANSFER_TYPE",
	"id": 1195,
	"rootId": "CHR1dGFub3RhAASr",
	"versioned": false,
	"encrypted": false,
	"values": {
		"_format": {
			"name": "_format",
			"id": 1196,
			"since": 45,
			"type": "Number",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		}
	},
	"associations": {
		"group": {
			"name": "group",
			"id": 1197,
			"since": 45,
			"type": "ELEMENT_ASSOCIATION",
			"cardinality": "One",
			"refType": "Group",
			"final": false,
			"external": true
		}
	},
	"app": "tutanota",
	"version": "45"
}

export function createTemplateGroupDeleteData(values?: $Shape<$Exact<TemplateGroupDeleteData>>): TemplateGroupDeleteData {
	return Object.assign(create(_TypeModel, TemplateGroupDeleteDataTypeRef), values)
}

export type TemplateGroupDeleteData = {
	_type: TypeRef<TemplateGroupDeleteData>;

	_format: NumberString;

	group: Id;
}