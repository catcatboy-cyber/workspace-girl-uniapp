const { questionDefinitions } = require('./config')

function createCaseId() {
  return `case-${Date.now()}`
}

function collectAssessmentData(formData) {
  const data = {}

  for (const question of questionDefinitions) {
    const value = formData.get(question.id)
    if (typeof value === 'string' && value.length > 0) {
      data[question.id] = value
    }
  }

  const t1 = formData.get('T1')
  const t2 = formData.get('T2')
  if (typeof t1 === 'string' && t1.length > 0) data.T1 = t1
  if (typeof t2 === 'string' && t2.length > 0) data.T2 = t2

  return data
}

function readOptionalField(formData, key) {
  const value = formData.get(key)
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function collectCaseProfile(formData) {
  const relationType = readOptionalField(formData, 'profileRelationType')

  return {
    relationType: relationType === 'close_friend' ? 'close_friend' : relationType === 'romantic' ? 'romantic' : undefined,
    avatar: readOptionalField(formData, 'profileAvatar'),
    age: readOptionalField(formData, 'profileAge'),
    gender: readOptionalField(formData, 'profileGender'),
    occupation: readOptionalField(formData, 'profileOccupation'),
    zodiac: readOptionalField(formData, 'profileZodiac'),
    constellation: readOptionalField(formData, 'profileConstellation')
  }
}

module.exports = {
  createCaseId,
  collectAssessmentData,
  readOptionalField,
  collectCaseProfile
}
