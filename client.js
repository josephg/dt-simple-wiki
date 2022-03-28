import {default as init, Doc} from 'diamond-types-web'
import { subscribe } from "@braid-protocol/client"

const calcDiff = (oldval, newval) => {
  // Strings are immutable and have reference equality. I think this test is O(1), so its worth doing.
  if (oldval === newval) return {pos: 0, del: 0, ins: ''}

  let oldChars = [...oldval]
  let newChars = [...newval]

  var commonStart = 0;
  while (oldChars[commonStart] === newChars[commonStart]) {
    commonStart++;
  }

  var commonEnd = 0;
  while (oldChars[oldChars.length - 1 - commonEnd] === newChars[newChars.length - 1 - commonEnd] &&
      commonEnd + commonStart < oldChars.length && commonEnd + commonStart < newChars.length) {
    commonEnd++;
  }

  const del = (oldChars.length !== commonStart + commonEnd)
    ? oldChars.length - commonStart - commonEnd
    : 0
  const ins = (newChars.length !== commonStart + commonEnd)
    ? newChars.slice(commonStart, newChars.length - commonEnd).join('')
    : ''

  return {
    pos: commonStart, del, ins
  }
}

;(async () => {

  await init()
  console.log('ok')

  const elem = document.getElementsByTagName("textarea")[0]
  console.log(elem)

  const braid = await subscribe('/data', {
    parseDoc(contentType, data) {
      const id = Math.random().toString(36).slice(2)
      console.log('id', id)

      let doc = Doc.fromBytes(data, id)
      let version = doc.getLocalVersion()
      console.log('v', Array.from(version), 'contents', JSON.stringify(doc.get()))
      console.log([...doc.get()])

      return [doc, version]
    },
    applyPatch([doc, version], patchType, patch) {
      // console.log('applyPatch')
      // console.log('doc', JSON.stringify(Array.from(doc.toBytes())))
      // console.log('patch', JSON.stringify(Array.from(patch)))
      let merge_version = doc.mergeBytes(patch)
      let new_version = doc.mergeVersions(version, merge_version)
      return [doc, new_version]
    }
  })

  const [doc, initialVersion] = braid.initialValue

  console.log('doc content', doc.get())

  let last_value = doc.get()
  let last_version = initialVersion

  let server_version = last_version

  elem.value = last_value


  const flush = async () => {
    // Merge the patches up to merge_version
    let sent_version = doc.getLocalVersion()
    let patch = doc.getPatchSince(server_version)
    try {
      const response = await fetch('/data', {
        method: 'PATCH',
        headers: {
          'content-type': 'application/diamond-types',
        },
        redirect: 'follow',
        body: patch,
      })

      server_version = doc.mergeVersions(server_version, sent_version)
      console.log('server version now', server_version)
    } catch (e) {
      console.error('Could not send patch', e)
    }
  }

  ;['textInput', 'keydown', 'keyup', 'select', 'cut', 'paste', 'input'].forEach(eventName => {
    elem.addEventListener(eventName, e => {
      setTimeout(() => {
        console.log('change detected')
        let new_value = elem.value
        if (new_value !== last_value) {
          // applyChange(remoteCtx, otdoc.get(), new_value.replace(/\r\n/g, '\n'))
          let {pos, del, ins} = calcDiff(last_value, new_value.replace(/\r\n/g, '\n'))

          if (del > 0) doc.del(pos, del)
          if (ins !== '') doc.ins(pos, ins)
          // console.log('server version', Array.from(server_version))

          last_version = doc.getLocalVersion()
          last_value = new_value

          flush()
        }
      }, 0)
    }, false)
  })


  for await (const msg of braid.updates) {
    console.log('got braid message', msg)
    elem.value = doc.get()
  }

})()