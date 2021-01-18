// @flow

import {create, TypeRef} from "../../common/EntityFunctions"

import type {InternalGroupData} from "./InternalGroupData"

export const TemplateGroupPostDataTypeRef: TypeRef<TemplateGroupPostData> = new TypeRef("tutanota", "TemplateGroupPostData")
export const _TypeModel: TypeModel = {
	"name": "TemplateGroupPostData",
	"since": 45,
	"type": "DATA_TRANSFER_TYPE",
	"id": 1189,
	"rootId": "CHR1dGFub3RhAASl",
	"versioned": false,
	"encrypted": false,
	"values": {
		"_format": {
			"name": "_format",
			"id": 1190,
			"since": 45,
			"type": "Number",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		},
		"groupInfoEncName": {
			"name": "groupInfoEncName",
			"id": 1191,
			"since": 45,
			"type": "Bytes",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		},
		"ownerEncTemplateGroupRootSessionKey": {
			"name": "ownerEncTemplateGroupRootSessionKey",
			"id": 1193,
			"since": 45,
			"type": "Bytes",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		},
		"userEncGroupKey": {
			"name": "userEncGroupKey",
			"id": 1192,
			"since": 45,
			"type": "Bytes",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		}
	},
	"associations": {
		"groupData": {
			"name": "groupData",
			"id": 1194,
			"since": 45,
			"type": "AGGREGATION",
			"cardinality": "One",
			"refType": "InternalGroupData",
			"final": false
		}
	},
	"app": "tutanota",
	"version": "45"
}

export function createTemplateGroupPostData(values?: $Shape<$Exact<TemplateGroupPostData>>): TemplateGroupPostData {
	return Object.assign(create(_TypeModel, TemplateGroupPostDataTypeRef), values)
}

export type TemplateGroupPostData = {
	_type: TypeRef<TemplateGroupPostData>;

	_format: NumberString;
	groupInfoEncName: Uint8Array;
	ownerEncTemplateGroupRootSessionKey: Uint8Array;
	userEncGroupKey: Uint8Array;

	groupData: InternalGroupData;
}