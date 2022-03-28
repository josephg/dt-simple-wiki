import {Branch, Doc, OpLog} from 'diamond-types-node'
import {stream as braidStream} from '@braid-protocol/server'
import express from 'express'
import bodyParser from 'body-parser'

const app = express()

app.use(express.static('dist'));
// app.use(express.static('public'));

const oplog = new OpLog()

oplog.setAgent('initial')
oplog.ins(0, 'hi')

// 1
// app.get('/data', (req, res, next) => {
//   const data = oplog.toBytes()

//   res.setHeader('content-type', 'application/diamond-types')
//   res.end(data)
// })

// 2

const clients = new Set()
app.get(`/data`, async (req, res, next) => {
  // console.log(req)

  const data = oplog.toBytes()

  const stream = braidStream(res, {
    reqHeaders: req.headers,
    initialValue: data,
    contentType: 'application/diamond-types',
    patchType: 'application/diamond-types',
    onclose() {
      if (stream) {
        console.log('stream closed', req.socket.remoteAddress)
        clients.delete(stream)
      }
    },
  })
  if (stream) {
    console.log('added stream', req.socket.remoteAddress)
    clients.add(stream)
  } else {
    console.log('sent initial data to', req.socket.remoteAddress)
  }
})

// 2.5

// setInterval(() => {
//   const vBefore = oplog.getLocalVersion()
//   oplog.ins(0, Math.random() > 0.5 ? '.' : '-')

//   for (const c of clients) {
//     c.append({
//       version: JSON.stringify(oplog.getRemoteVersion()),
//       patches: [oplog.getPatchSince(vBefore)]
//     })
//   }
// }, 1000)


// 3

app.patch(`/data`, bodyParser.raw({type: 'application/diamond-types'}), (req, res, next) => {
  const patch = req.body
  console.log(`got patch ${patch.length} from ${req.socket.remoteAddress}`)

  const vBefore = oplog.getLocalVersion()
  oplog.addFromBytes(patch)

  for (const c of clients) {
    c.append({
      version: JSON.stringify(oplog.getRemoteVersion()),
      patches: [oplog.getPatchSince(vBefore)]
    })
  }

  res.end()
})

app.listen(4322, err => {
  if (err) throw err

  console.log('listening on port 4322')
})