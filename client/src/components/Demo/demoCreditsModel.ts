import credits from './photoCredits.json';

/**
 * One photo of the demo content as Wikimedia Commons credits it: the file's
 * name there, its author and the short name of its license. The page on
 * Commons, the title to show and the license's deed all follow from these, so
 * photoCredits.json holds nothing else.
 */
export interface PhotoCredit {
  file: string;
  author: string;
  license: string;
}

/**
 * Every photo in the demo content, sorted by file name. The authors are the
 * plain names: where Commons fills the field with a notice or a link label
 * ("This Photo was taken by ...", "(Flickr)"), the list holds the name it
 * gives, and where the author asks to be credited in a set form, that form.
 */
export const PHOTO_CREDITS: readonly PhotoCredit[] = credits;

/** The license name Commons gives a photo nobody holds a copyright in; it has no deed to link. */
export const PUBLIC_DOMAIN = 'Public domain';

const COMMONS_FILE_PAGE = 'https://commons.wikimedia.org/wiki/File:';

/** The file's name without its extension, the title Commons shows above the photo. */
export function creditTitle(file: string): string {
  const dot = file.lastIndexOf('.');
  return dot > 0 ? file.slice(0, dot) : file;
}

/** The file's page on Commons, with its full description and license. */
export function commonsPage(file: string): string {
  return COMMONS_FILE_PAGE + encodeURIComponent(file.replace(/ /g, '_'));
}

/**
 * The deed of a Creative Commons license by the short name Commons gives it:
 * "CC BY-SA 4.0", a ported one such as "CC BY-SA 2.0 de", or "CC0". Nothing
 * for the public domain, which is no license.
 */
export function licenseDeed(license: string): string | undefined {
  if (license === 'CC0') return 'https://creativecommons.org/publicdomain/zero/1.0/';
  const match = /^CC (BY(?:-SA)?) (\d\.\d)(?: ([a-z]{2}))?$/.exec(license);
  if (!match) return undefined;
  const [, terms, version, port] = match;
  return `https://creativecommons.org/licenses/${terms.toLowerCase()}/${version}/${port ? `${port}/` : ''}`;
}
