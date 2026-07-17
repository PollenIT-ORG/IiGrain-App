import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { VISIT_MAP_HTML } from './visitMapHtml';

const SOURCE = { html: VISIT_MAP_HTML } as const;
const ORIGIN_WHITELIST = ['*'];

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface VisitMapProps {
  assessor: LatLng | null;
  destination: LatLng | null;
  style?: ViewStyle;
}

const VisitMap: React.FC<VisitMapProps> = ({ assessor, destination, style }) => {
  const webRef = useRef<WebView<unknown>>(null);
  const [ready, setReady] = useState(false);

  const inject = useCallback((js: string) => {
    webRef.current?.injectJavaScript(`${js} true;`);
  }, []);

  const onMessage = useCallback((e: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(e.nativeEvent.data);
      if (msg.type === 'log') {
        console.log('[visitmap]', msg.message);
      } else if (msg.type === 'ready') {
        setReady(true);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (ready && destination) {
      inject(`window.VISIT && window.VISIT.setDestination(${destination.latitude}, ${destination.longitude});`);
    }
  }, [ready, destination, inject]);

  useEffect(() => {
    if (ready && assessor) {
      console.log('[visitmap] → setAssessor', assessor.latitude, assessor.longitude);
      inject(`window.VISIT && window.VISIT.setAssessor(${assessor.latitude}, ${assessor.longitude});`);
    }
  }, [ready, assessor, inject]);

  return (
    <View style={[styles.wrap, style]}>
      <WebView<unknown>
        ref={webRef}
        source={SOURCE}
        originWhitelist={ORIGIN_WHITELIST}
        onMessage={onMessage}
        javaScriptEnabled
        domStorageEnabled
        cacheEnabled
        startInLoadingState
        style={styles.web}
      />
    </View>
  );
};

export default React.memo(VisitMap);

const styles = StyleSheet.create({
  wrap: { flex: 1, overflow: 'hidden', backgroundColor: '#e8eef0' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
