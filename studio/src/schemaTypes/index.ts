import {acsCode} from './documents/acsCode'
import {contentRelease} from './documents/contentRelease'
import {figure} from './documents/figure'
import {glossaryTerm} from './documents/glossaryTerm'
import {lesson} from './documents/lesson'
import {module} from './documents/module'
import {question} from './documents/question'
import {section} from './documents/section'
import {answerOption} from './objects/answerOption'
import {imageQuestionSpec} from './objects/imageQuestionSpec'
import {lessonBlock} from './objects/lessonBlock'
import {matchingAnswerSpec} from './objects/matchingAnswerSpec'
import {matchingPair} from './objects/matchingPair'
import {multipleChoiceAnswerSpec} from './objects/multipleChoiceAnswerSpec'
import {numericAnswerSpec} from './objects/numericAnswerSpec'
import {richText} from './objects/richText'
import {sourceCitation} from './objects/sourceCitation'

export const schemaTypes = [
  sourceCitation,
  richText,
  answerOption,
  multipleChoiceAnswerSpec,
  numericAnswerSpec,
  matchingPair,
  matchingAnswerSpec,
  imageQuestionSpec,
  lessonBlock,
  module,
  section,
  lesson,
  question,
  figure,
  glossaryTerm,
  acsCode,
  contentRelease,
]
