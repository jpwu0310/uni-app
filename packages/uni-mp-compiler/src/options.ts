import { ParserPlugin } from '@babel/parser'
import { Expression, ObjectProperty, SpreadElement } from '@babel/types'
import { BindingMetadata, CompilerError, RootNode } from '@vue/compiler-core'
import IdentifierGenerator from './identifier'
import {
  DirectiveTransform,
  NodeTransform,
  TransformContext,
} from './transform'
import { VForOptions } from './transforms/vFor'

export interface CodegenRootNode extends RootNode {
  scope: CodegenScope
  bindingComponents: TransformContext['bindingComponents']
}

export interface ErrorHandlingOptions {
  onWarn?: (warning: CompilerError) => void
  onError?: (error: CompilerError) => void
}

interface ParserOptions {
  /**
   * e.g. platform native elements, e.g. `<div>` for browsers
   */
  isNativeTag?: (tag: string) => boolean
  /**
   * e.g. native elements that can self-close, e.g. `<img>`, `<br>`, `<hr>`
   */
  isVoidTag?: (tag: string) => boolean
  /**
   * Separate option for end users to extend the native elements list
   */
  isCustomElement?: (tag: string) => boolean | void
}

interface SharedTransformCodegenOptions {
  inline?: boolean
  isTS?: boolean
  filename?: string
  bindingMetadata?: BindingMetadata
  prefixIdentifiers?: boolean
}

export interface TransformOptions
  extends SharedTransformCodegenOptions,
    ErrorHandlingOptions {
  scopeId?: string | null
  cacheHandlers?: boolean
  nodeTransforms?: NodeTransform[]
  directiveTransforms?: Record<string, DirectiveTransform | undefined>
  isBuiltInComponent?: (tag: string) => symbol | void
  isCustomElement?: (tag: string) => boolean | void
  expressionPlugins?: ParserPlugin[]
  skipTransformIdentifier?: boolean
}

export interface CodegenRootScope {
  id: IdentifierGenerator
  identifiers: string[]
  properties: (ObjectProperty | SpreadElement)[]
  parent: CodegenScope | null
}
export interface CodegenVIfScopeInit {
  name: 'if' | 'else-if' | 'else' | string
  condition?: Expression
}
export type CodegenVForScopeInit = VForOptions & { locals: string[] }
export interface CodegenVIfScope extends CodegenRootScope, CodegenVIfScopeInit {
  parentScope: CodegenRootScope | CodegenVForScope
}
export interface CodegenVForScope
  extends CodegenRootScope,
    CodegenVForScopeInit {}

export type CodegenScope = CodegenRootScope | CodegenVIfScope | CodegenVForScope

interface EmittedFile {
  fileName?: string
  name?: string
  source?: string | Uint8Array
  type: 'asset'
}

export interface CodegenOptions extends SharedTransformCodegenOptions {
  mode?: 'module' | 'function'
  scopeId?: string | null
  runtimeModuleName?: string
  runtimeGlobalName?: string
  miniProgram?: {
    slot: {
      fallback: boolean
    }
    directive: string
    emitFile?: (emittedFile: EmittedFile) => string
  }
}

export interface TemplateCodegenOptions {
  slot: {
    fallback: boolean
  }
  scopeId?: string | null
  filename: string
  directive: string
  emitFile: (emittedFile: EmittedFile) => string
}

export type CompilerOptions = ParserOptions & TransformOptions & CodegenOptions
