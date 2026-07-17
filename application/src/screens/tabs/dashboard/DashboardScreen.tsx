import { StyleSheet, View } from 'react-native'
import React from 'react'
import { COLORS, presets, spacing } from '../../../constants'
import { AppText } from '../../../components'

const DashboardScreen = () => {
  return (
    <View style={styles.container}>
      <AppText style={styles.title}>Dashboard</AppText>
      <AppText style={styles.subtitle}>Welcome to iiGrain</AppText>
    </View>
  )
}

export default DashboardScreen

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing[4],
  },
  title: {
    ...presets.headingLG,
    color: COLORS.gray900,
    marginBottom: spacing[2],
  },
  subtitle: {
    ...presets.bodySM,
    color: COLORS.gray500,
  },
})
