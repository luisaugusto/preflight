import {BookIcon} from '@sanity/icons/Book'
import {ComposeIcon} from '@sanity/icons/Compose'
import {DocumentsIcon} from '@sanity/icons/Documents'
import {EarthGlobeIcon} from '@sanity/icons/EarthGlobe'
import {FeedbackIcon} from '@sanity/icons/Feedback'
import {HelpCircleIcon} from '@sanity/icons/HelpCircle'
import {ImageIcon} from '@sanity/icons/Image'
import {RocketIcon} from '@sanity/icons/Rocket'
import {TagIcon} from '@sanity/icons/Tag'
import type {StructureResolver} from 'sanity/structure'

export const structure: StructureResolver = (S) => {
  const reportsByStatus = (title: string, status: string) =>
    S.documentList()
      .id(`content-reports-${status}`)
      .title(title)
      .filter('_type == "contentReport" && status == $status')
      .params({status})
      .defaultOrdering([{field: '_createdAt', direction: 'desc'}])

  const allReports = S.documentList()
    .id('content-reports-all')
    .title('All reports')
    .filter('_type == "contentReport"')
    .defaultOrdering([{field: '_createdAt', direction: 'desc'}])

  return S.list()
    .title('Preflight content')
    .items([
      S.listItem()
        .title('Content reports')
        .icon(FeedbackIcon)
        .child(
          S.list()
            .title('Content reports')
            .items([
              S.listItem()
                .title('New')
                .icon(FeedbackIcon)
                .child(reportsByStatus('New reports', 'new')),
              S.listItem()
                .title('In progress')
                .icon(FeedbackIcon)
                .child(reportsByStatus('Reports in progress', 'inProgress')),
              S.listItem()
                .title('Resolved')
                .icon(FeedbackIcon)
                .child(reportsByStatus('Resolved reports', 'resolved')),
              S.listItem()
                .title('Won’t fix')
                .icon(FeedbackIcon)
                .child(reportsByStatus('Reports that won’t be fixed', 'wontFix')),
              S.divider(),
              S.listItem().title('All reports').icon(FeedbackIcon).child(allReports),
            ]),
        ),
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
}
