import { describe, expect, it } from 'vitest';
import { PHOTO_CREDITS, PUBLIC_DOMAIN, commonsPage, creditTitle, licenseDeed } from './demoCreditsModel';

describe('demo photo credits', () => {
  it('FE-DEMO-CREDITS-001: credits every photo of the demo content, each file once', () => {
    expect(PHOTO_CREDITS).toHaveLength(228);
    expect(new Set(PHOTO_CREDITS.map((c) => c.file)).size).toBe(228);
    for (const { file } of PHOTO_CREDITS) expect(file, file).toMatch(/\.jpe?g$/i);
  });

  it('FE-DEMO-CREDITS-002: every author is a plain name, with no Commons notice or link label left', () => {
    for (const { file, author } of PHOTO_CREDITS) {
      expect(author.trim(), file).not.toBe('');
      expect(author, file).toBe(author.trim());
      expect(author.length, `${file}: ${author}`).toBeLessThanOrEqual(60);
      expect(author, file).not.toMatch(/\s{2,}|\n/);
      expect(author, file).not.toMatch(
        /Photo was taken|machine-readable|assumed|Feel free|copyright|https?:|User:|\((?:Website|Flickr)\)/i
      );
    }
    const authorOf = (file: string) => PHOTO_CREDITS.find((c) => c.file === file)?.author;
    expect(authorOf('Drei Zinnen Tre Cime di Lavaredo Dolomites.jpg')).toBe('Wolfgang Moroder');
    expect(authorOf('Iceland Godafoss 1972.jpg')).toBe('Roger McLassus');
    expect(authorOf('Arashiyama Bamboo Grove (Unsplash).jpg')).toBe('Erol Ahmed');
  });

  it('FE-DEMO-CREDITS-003: every license has its deed, except the public domain', () => {
    for (const { file, license } of PHOTO_CREDITS) {
      if (license === PUBLIC_DOMAIN) expect(licenseDeed(license), file).toBeUndefined();
      else expect(licenseDeed(license), `${file}: ${license}`).toMatch(/^https:\/\/creativecommons\.org\/.+\/$/);
    }
  });

  it('FE-DEMO-CREDITS-004: derives the deed from the license name', () => {
    expect(licenseDeed('CC BY-SA 4.0')).toBe('https://creativecommons.org/licenses/by-sa/4.0/');
    expect(licenseDeed('CC BY 2.5')).toBe('https://creativecommons.org/licenses/by/2.5/');
    expect(licenseDeed('CC BY-SA 2.0 de')).toBe('https://creativecommons.org/licenses/by-sa/2.0/de/');
    expect(licenseDeed('CC0')).toBe('https://creativecommons.org/publicdomain/zero/1.0/');
    expect(licenseDeed(PUBLIC_DOMAIN)).toBeUndefined();
    expect(licenseDeed('GFDL')).toBeUndefined();
  });

  it('FE-DEMO-CREDITS-005: shows the title without its extension and links the page on Commons', () => {
    expect(creditTitle('Café A Brasileira. Sculpture.jpg')).toBe('Café A Brasileira. Sculpture');
    expect(creditTitle('Svínafellsjökull.JPG')).toBe('Svínafellsjökull');
    expect(creditTitle('No extension')).toBe('No extension');
    expect(commonsPage('Lagoa Rasa (Sete Cidades) 2.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/File:Lagoa_Rasa_(Sete_Cidades)_2.jpg'
    );
    expect(commonsPage('Glacier du Géant & Mont Blanc.jpg')).toBe(
      'https://commons.wikimedia.org/wiki/File:Glacier_du_G%C3%A9ant_%26_Mont_Blanc.jpg'
    );
  });
});
