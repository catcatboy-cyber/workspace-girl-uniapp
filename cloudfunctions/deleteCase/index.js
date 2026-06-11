const cloudbase = require('@cloudbase/node-sdk')
const { requireAuthenticatedUserId, buildAuthErrorResponse, getOwnedCase } = require('./_shared/auth')
const app = cloudbase.init({ env: cloudbase.SYMBOL_CURRENT_ENV })
const db = app.database()

const DELETE_BATCH_SIZE = 100

function collectAttachmentFileIds(records) {
  const fileIds = new Set()
  for (const record of records || []) {
    const attachments = Array.isArray(record.attachments) ? record.attachments : []
    for (const attachment of attachments) {
      const fileID = String(attachment?.fileID || '').trim()
      if (fileID) fileIds.add(fileID)
    }
  }
  return Array.from(fileIds)
}

async function removeDocsByCaseId(collectionName, caseId, onBatch) {
  let removed = 0

  while (true) {
    const res = await db.collection(collectionName)
      .where({ caseId })
      .limit(DELETE_BATCH_SIZE)
      .get()
    const docs = res.data || []
    if (docs.length === 0) break

    if (typeof onBatch === 'function') await onBatch(docs)

    await Promise.all(docs
      .map((doc) => doc._id)
      .filter(Boolean)
      .map((id) => db.collection(collectionName).doc(id).remove()))

    removed += docs.length
  }

  return removed
}

async function deleteCloudFiles(fileIds) {
  const uniqueIds = Array.from(new Set((fileIds || []).filter(Boolean)))
  if (uniqueIds.length === 0 || typeof app.deleteFile !== 'function') {
    return { attempted: uniqueIds.length, deleted: 0, failed: 0 }
  }

  let deleted = 0
  let failed = 0
  for (let i = 0; i < uniqueIds.length; i += DELETE_BATCH_SIZE) {
    const fileList = uniqueIds.slice(i, i + DELETE_BATCH_SIZE)
    try {
      const result = await app.deleteFile({ fileList })
      const results = result?.fileList || []
      if (results.length === 0) {
        deleted += fileList.length
      } else {
        deleted += results.filter((item) => !item.code && !item.error).length
        failed += results.filter((item) => item.code || item.error).length
      }
    } catch (error) {
      failed += fileList.length
      console.warn('[deleteCase] delete cloud files failed:', error?.message || error)
    }
  }
  return { attempted: uniqueIds.length, deleted, failed }
}

exports.main = async (event) => {
  const { caseId } = event
  try {
    const userId = await requireAuthenticatedUserId(app, event)
    if (!caseId) return { success: false, message: '缺少档案ID' }

    // 先验证权限（事务外）
    const { error: caseError } = await getOwnedCase(db, caseId, userId)
    if (caseError) return caseError

    const attachmentFileIds = []
    const timelineRemoved = await removeDocsByCaseId('timeline_records', caseId, (records) => {
      attachmentFileIds.push(...collectAttachmentFileIds(records))
    })
    const assessmentsRemoved = await removeDocsByCaseId('assessments', caseId)

    await db.collection('cases').doc(caseId).remove()

    const fileDelete = await deleteCloudFiles(attachmentFileIds)

    return {
      success: true,
      deleted: {
        case: 1,
        timelineRecords: timelineRemoved,
        assessments: assessmentsRemoved,
        files: fileDelete
      }
    }
  } catch (error) {
    const authError = buildAuthErrorResponse(error)
    if (authError) return authError
    console.error('deleteCase error:', error)
    return { success: false, message: '删除档案失败' }
  }
}
