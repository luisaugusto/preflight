import {BookIcon} from '@sanity/icons/Book'
import {ComposeIcon} from '@sanity/icons/Compose'
import {DocumentsIcon} from '@sanity/icons/Documents'
import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {HelpCircleIcon} from '@sanity/icons/HelpCircle'
import {ImageIcon} from '@sanity/icons/Image'
import {RocketIcon} from '@sanity/icons/Rocket'
import {TagIcon} from '@sanity/icons/Tag'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) =>
  S.list()
    .title('Preflight content')
    .items([
      S.listItem()
        .title('Curriculum')
        .icon(BookIcon)
        .child(
          S.list()
            .title('Curriculum')
            .items([
              S.documentTypeListItem('module').title('Modules').icon(BookIcon),
              S.documentTypeListItem('section').title('Sections').icon(DocumentsIcon),
              S.documentTypeListItem('lesson').title('Lessons').icon(ComposeIcon),
            ]),
        ),
      S.listItem()
        .title('Assessment')
        .icon(HelpCircleIcon)
        .child(
          S.list()
            .title('Assessment')
            .items([
              S.documentTypeListItem('question').title('Questions').icon(HelpCircleIcon),
            ]),
        ),
      S.listItem()
        .title('Reference library')
        .icon(ImageIcon)
        .child(
          S.list()
            .title('Reference library')
            .items([
              S.documentTypeListItem('figure').title('Figures').icon(ImageIcon),
              S.documentTypeListItem('glossaryTerm').title('Glossary').icon(TagIcon),
              S.documentTypeListItem('acsCode').title('ACS codes').icon(EarthGlobeIcon),
            ]),
        ),
      S.divider(),
      S.documentTypeListItem('contentRelease').title('Content releases').icon(RocketIcon),
    ])
