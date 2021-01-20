//@flow

import type {GroupInfo} from "../api/entities/sys/GroupInfo"
import type {TemplateGroupRoot} from "../api/entities/tutanota/TemplateGroupRoot"
import {EventController} from "../api/main/EventController"
import type {LoginController} from "../api/main/LoginController"
import {EntityClient} from "../api/common/EntityClient"
import type {EntityEventsListener} from "../api/main/EventController"
import {EmailTemplateTypeRef} from "../api/entities/tutanota/EmailTemplate"
import {LazyLoaded} from "../api/common/utils/LazyLoaded"
import type {GroupMembership} from "../api/entities/sys/GroupMembership"
import {GroupInfoTypeRef} from "../api/entities/sys/GroupInfo"
import {TemplateGroupRootTypeRef} from "../api/entities/tutanota/TemplateGroupRoot"
import {neverNull} from "../api/common/utils/Utils"

type TemplateGroupInstances = {
	groupInfo: GroupInfo,
	groupRoot: TemplateGroupRoot
}


export class TemplateGroupModel {
	+_eventController: EventController;
	+_entityEventReceived: EntityEventsListener;
	+_logins: LoginController;
	+_entityClient: EntityClient;
	_groupInstances: LazyLoaded<Array<TemplateGroupInstances>>

	constructor(eventController: EventController, logins: LoginController, entityClient: EntityClient) {
		this._eventController = eventController
		this._logins = logins
		this._entityClient = entityClient
		this._groupInstances = new LazyLoaded(() => {
			const templateMemberships = logins.getUserController().getTemplateMemberships()
			return Promise.map( templateMemberships,  (templateMembership) => {
				return this._loadGroupInstances(templateMembership)
			} , {concurrency:1})
		}, [])
	}

	_loadGroupInstances(templateGroupMembership: GroupMembership): Promise<TemplateGroupInstances> {
		return this._entityClient.load(GroupInfoTypeRef, templateGroupMembership.groupInfo)
		           .then(groupInfo => {
			           return this._entityClient.load(TemplateGroupRootTypeRef, templateGroupMembership.group)
			                      .then(groupRoot => {
				                      return {
					                      groupInfo,
					                      groupRoot
				                      }
			                      })
		           })
	}

	init():Promise<Array<TemplateGroupInstances>> {
		return this._groupInstances.getAsync();
	}

	getGroupInstances():Array<TemplateGroupInstances> {
		return neverNull(this._groupInstances.getSync())
	}


}