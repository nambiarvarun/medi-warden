import React, { ReactNode } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  ViewStyle,
  StatusBar,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, spacing } from '../../theme';

interface ScreenWrapperProps {
  children: ReactNode;
  style?: ViewStyle;
  scrollable?: boolean;
  padded?: boolean;
  safeArea?: boolean;
  backgroundColor?: string;
  avoidBottomInset?: boolean;
}

export const ScreenWrapper = React.memo(function ScreenWrapper({
  children,
  style,
  scrollable = true,
  padded = true,
  safeArea = true,
  backgroundColor = colors.background,
  avoidBottomInset = false,
}: ScreenWrapperProps) {
  const insets = useSafeAreaInsets();

  const content = (
    <View
      style={[
        styles.container,
        padded && styles.padded,
        { backgroundColor },
        style,
      ]}
    >
      {children}
    </View>
  );

  const scrollContent = scrollable ? (
    <ScrollView
      style={[styles.scroll, { backgroundColor }]}
      contentContainerStyle={[
        styles.scrollContent,
        avoidBottomInset && { paddingBottom: insets.bottom },
      ]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {content}
    </ScrollView>
  ) : (
    content
  );

  if (safeArea) {
    return (
      <>
        <StatusBar
          barStyle="dark-content"
          backgroundColor={backgroundColor}
        />
        <SafeAreaView
          style={[styles.safeArea, { backgroundColor }]}
          edges={['top', 'left', 'right']}
        >
          {scrollContent}
        </SafeAreaView>
      </>
    );
  }

  return (
    <>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={backgroundColor}
      />
      {scrollContent}
    </>
  );
});

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
  },
  padded: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingVertical: spacing.screenVertical,
  },
});
