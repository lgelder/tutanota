//@flow
import type {EmailTemplate} from "../api/entities/tutanota/EmailTemplate"


export function searchInTemplates(input: string, allTemplates: Array<EmailTemplate>): Array<EmailTemplate> {
	let matchedTemplates = []
	let queryWords = input.toLowerCase().trim().split(" ")
	for (const queryString of queryWords) {
		if (queryString) {
			allTemplates.forEach(template => {
				let templateTitle = template.title.toLowerCase()
				let templateTag = template.tag
				let templateContents = template.contents
				//search in title
				if (templateTitle.includes(queryString) && !matchedTemplates.includes(template)) {
					matchedTemplates.push(template)
				}
				//search in tag
				if (templateTag.includes(queryString) && !matchedTemplates.includes(template)) {
					matchedTemplates.push(template)
				}
				//search in contents
				templateContents.forEach(c => {
					let content = c.text.toLowerCase()
					if (content.includes(queryString) && !matchedTemplates.includes(template)) {
						matchedTemplates.push(template)
					}
				})
			})
		}
	}
	return matchedTemplates
}
