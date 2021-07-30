import { normalizeIdentifier, normalizePagePath } from '../../../utils'

export function definePageCode(pagesJson: Record<string, any>) {
  const importPagesCode: string[] = []
  const definePagesCode: string[] = []
  pagesJson.pages.forEach((page: UniApp.UniRoute) => {
    const pagePath = page.path
    const pageIdentifier = normalizeIdentifier(pagePath)
    const pagePathWithExtname = normalizePagePath(pagePath, 'app')
    if (pagePathWithExtname) {
      if (process.env.UNI_APP_CODE_SPLITING) {
        // 拆分页面
        importPagesCode.push(
          `const ${pageIdentifier} = ()=>import('./${pagePathWithExtname}?mpType=page')`
        )
      } else {
        importPagesCode.push(
          `import ${pageIdentifier} from './${pagePathWithExtname}?mpType=page'`
        )
      }
      definePagesCode.push(`__definePage('${pagePath}',${pageIdentifier})`)
    }
  })
  return importPagesCode.join('\n') + '\n' + definePagesCode.join('\n')
}