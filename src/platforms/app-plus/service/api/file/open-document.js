import {
  getRealPath
} from '../util'

import {
  invoke
} from '../../bridge'

export function openDocument ({
  filePath,
  fileType
} = {}, callbackId) {
  plus.io.resolveLocalFileSystemURL(getRealPath(filePath), entry => {
    plus.runtime.openFile(getRealPath(filePath))
    invoke(callbackId, {
      errMsg: 'openDocument:ok'
    })
  }, err => {
    invoke(callbackId, {
      errMsg: 'openDocument:fail ' + err.message
    })
  })
}
