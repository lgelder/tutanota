//@flow
import path from "path"
import url from "url"
import {sanitizeFilename} from "../api/common/utils/FileUtils"
import {neverNull} from "../api/common/utils/Utils"

/**
 * @param pathToConvert absolute Path to a file
 * @returns {string} file:// URL that can be extended with query parameters and loaded with BrowserWindow.loadURL()
 */
export function pathToFileURL(pathToConvert: string): string {
	pathToConvert = pathToConvert
		.trim()
		.split(path.sep)
		.map((fragment) => encodeURIComponent(fragment))
		.join("/")
	const extraSlashForWindows = process.platform === "win32" && pathToConvert !== ''
		? "/"
		: ""
	let urlFromPath = url.format({
		pathname: extraSlashForWindows + pathToConvert.trim(),
		protocol: 'file:'
	})

	return urlFromPath.trim()
}

/**
 * compares a filename to a list of filenames and finds the first number-suffixed
 * filename not already contained in the list.
 * @returns {string} the basename appended with '-<first non-clashing positive number>.<ext>
 */
export function nonClobberingFilename(files: Array<string>, filename: string): string {
	filename = sanitizeFilename(filename)
	const clashingFile = files.find(f => f.toLowerCase() === filename)
	if (typeof clashingFile !== "string" && !_isReservedFilename(filename)) { // all is well
		return filename
	} else { // there are clashing file names or the file name is reserved
		const ext = path.extname(filename)
		const basename = path.basename(filename, ext)
		const clashNumbers: Array<number> = files
			.filter(f => f.startsWith(`${basename}-`))
			.map(f => f.slice(0, f.length - ext.length))
			.map(f => f.slice(basename.length + 1, f.length))
			.map(f => !f.startsWith('0') ? parseInt(f, 10) : 0)
			.filter(n => !isNaN(n) && n > 0)
		const clashNumbersSet: Set<number> = new Set(clashNumbers)
		clashNumbersSet.add(0)

		// if a number is bigger than its index, there is room somewhere before that number
		const firstGapMinusOne = Array
			.from(clashNumbersSet)
			.sort((a, b) => a - b)
			.find((n, i, a) => a[i + 1] > i + 1)

		return !isNaN(firstGapMinusOne)
			? `${basename}-${neverNull(firstGapMinusOne) + 1}${ext}`
			: `${basename}-${clashNumbersSet.size}${ext}`
	}
}

/**
 * checks if the given filename is a reserved filename on the current platform
 * @param filename
 * @returns {boolean}
 * @private
 */
function _isReservedFilename(filename: string): boolean {
	// CON, CON.txt, COM0 etc. (windows device files)
	const winReservedRe = /^(CON|PRN|LPT[0-9]|COM[0-9]|AUX|NUL)($|\..*$)/i
	// .. and .
	const reservedRe = /^\.{1,2}$/

	return (process.platform === "win32" && winReservedRe.test(filename)) || reservedRe.test(filename)
}

export function looksExecutable(file: string): boolean {
	// only windows will happily execute a just downloaded program
	if (process.platform === 'win32') {
		// taken from https://www.lifewire.com/list-of-executable-file-extensions-2626061
		const ext = path.extname(file).toLowerCase().slice(1)
		return [
			'exe', 'bat', 'bin', 'cmd', 'com', 'cpl', 'gadget',
			'inf', 'inx', 'ins', 'isu', 'job', 'jse', 'lnk', 'msc',
			'msi', 'msp', 'mst', 'paf', 'pif', 'ps1', 'reg', 'rgs',
			'scr', 'sct', 'shb', 'sct', 'shs', 'u3p', 'vb', 'vbe',
			'vbs', 'vbscript', 'ws', 'wsf', 'wsh'
		].includes(ext)
	}

	return false
}

/**
 * take array of file names and add numbered suffixes to the basename of
 * duplicates. Use to make a legal set of names for files written to disk
 * at the same time.
 *
 * treats file names that already have numbered suffixes as non-numbered.
 * assumes the file system is case insensitive (a.txt would overwrite A.TXT)
 *
 * @param files file names.
 * @returns map from old names to array of new names. use map[oldname].shift() to replace oldname with newname.
 */
export function legalizeFilenames(files: Array<string>): {[string]: Array<string>} {
	const suffix = (name, suf) => {
		const ext = path.extname(name)
		const basename = path.basename(name, ext)
		return `${basename}-${suf}${ext}`
	}
	const unreserveFilename = name => _isReservedFilename(name) ? suffix(name, "") : name

	let cleaned = files.map(sanitizeFilename).map(unreserveFilename)
	let dedup = new Set(cleaned.map(s => s.toLowerCase()))
	let conv = cleaned.map((e, i) => [files[i], e]) // pairs [oldname, newname]
	if (dedup.size === cleaned.length) {
		return conv.reduce((m, [o, n]) => ({...m, [o]: [n]}), {}) // convert into map oldname -> [newname]
	}

	const out = {}
	const news = {}
	conv.forEach(([o, n]) => {
		const lower = n.toLowerCase()
		let newname
		if (news[lower] === undefined) {
			news[lower] = 0
			newname = n
		} else {
			news[lower] = news[lower] + 1
			newname = suffix(n, news[lower])
		}
		if (out[o]) {
			out[o].push(newname)
		} else {
			out[o] = [newname]
		}
	})

	return out
}
