// @flow

import {create} from "../../common/EntityFunctions"
import {TypeRef} from "../../common/utils/EntityUtils";


export const PasswordRetrievalDataTypeRef: TypeRef<PasswordRetrievalData> = new TypeRef("tutanota", "PasswordRetrievalData")
export const _TypeModel: TypeModel = {
	"name": "PasswordRetrievalData",
	"since": 1,
	"type": "DATA_TRANSFER_TYPE",
	"id": 320,
	"rootId": "CHR1dGFub3RhAAFA",
	"versioned": false,
	"encrypted": false,
	"values": {
		"_format": {
			"name": "_format",
			"id": 321,
			"since": 1,
			"type": "Number",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		},
		"autoAuthenticationId": {
			"name": "autoAuthenticationId",
			"id": 322,
			"since": 1,
			"type": "GeneratedId",
			"cardinality": "One",
			"final": false,
			"encrypted": false
		}
	},
	"associations": {},
	"app": "tutanota",
	"version": "43"
}

export function createPasswordRetrievalData(values?: $Shape<$Exact<PasswordRetrievalData>>): PasswordRetrievalData {
	return Object.assign(create(_TypeModel, PasswordRetrievalDataTypeRef), values)
}

export type PasswordRetrievalData = {
	_type: TypeRef<PasswordRetrievalData>;

	_format: NumberString;
	autoAuthenticationId: Id;
}