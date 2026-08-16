import assert from 'node:assert/strict'
import test from 'node:test'

globalThis.window = {
  location: {
    origin: 'http://localhost',
    pathname: '/',
    protocol: 'http:',
  },
  clearTimeout,
  setTimeout,
}

const { SocketManager } = await import('../static/js/socket.js')

test('temporary sync unavailability keeps Socket.IO reconnects alive', () => {
  const manager = new SocketManager()
  let disconnectCalls = 0
  let unavailableCalls = 0
  manager.socket = {
    disconnect() {
      disconnectCalls += 1
    },
  }
  manager.on('syncUnavailable', () => {
    unavailableCalls += 1
  })

  manager._markSyncUnavailable('test outage')

  assert.equal(disconnectCalls, 0)
  assert.equal(unavailableCalls, 1)
  assert.equal(manager.isOnline, false)
})

test('socket subscriptions can be removed without affecting other listeners', () => {
  const manager = new SocketManager()
  const calls = []
  const unsubscribe = manager.on('markerUpdate', () => calls.push('removed'))
  manager.on('markerUpdate', () => calls.push('retained'))

  unsubscribe()
  manager._trigger('markerUpdate', { index: 1 })

  assert.deepEqual(calls, ['retained'])
})
