import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { COLORS, presets } from '../../constants';
import { moderateScale, scale } from '../../utils';

export interface TrendDatum {
  year: number;
  value: number;
}

export interface RegenTrendChartProps {
  data: TrendDatum[];
  selectedYear: number;
}

const Y_AXIS_WIDTH = scale(30);
const CHART_HEIGHT = scale(172);

const RegenTrendChart: React.FC<RegenTrendChartProps> = ({ data, selectedYear }) => {
  const [containerW, setContainerW] = useState(0);

  const chartData = data.map(p => {
    const active = p.year === selectedYear;
    return {
      value: p.value,
      label: String(p.year),
      dataPointText: String(p.value),
      dataPointColor: active ? COLORS.primaryDark : COLORS.primary,
      dataPointRadius: active ? scale(6) : scale(4),
      textFontSize: moderateScale(active ? 13 : 12),
      textColor: COLORS.gray900,
      textShiftY: -moderateScale(14),
    };
  });

  const initialSpacing = scale(18);
  const endSpacing = scale(18);
  const plotWidth = containerW > 0 ? containerW - Y_AXIS_WIDTH - scale(6) : 0;
  // A single year is a valid chart (one dot). Spacing only has meaning between
  // points, so it falls back to the usable width instead of dividing by zero.
  const usableWidth = Math.max(plotWidth - initialSpacing - endSpacing, 0);
  const pointSpacing = data.length > 1 ? usableWidth / (data.length - 1) : usableWidth;

  return (
    <View
      style={styles.wrap}
      onLayout={e => setContainerW(e.nativeEvent.layout.width)}>
      {plotWidth > 0 ? (
        <LineChart
          data={chartData}
          height={CHART_HEIGHT}
          width={plotWidth}
          spacing={pointSpacing}
          initialSpacing={initialSpacing}
          endSpacing={endSpacing}
          maxValue={100}
          noOfSections={4}
          color={COLORS.primary}
          thickness={scale(3)}
          curved
          dataPointsColor={COLORS.primary}
          dataPointsRadius={scale(4)}
          textColor={COLORS.gray900}
          textFontSize={moderateScale(12)}
          yAxisColor={COLORS.gray200}
          xAxisColor={COLORS.gray200}
          yAxisThickness={1}
          xAxisThickness={1}
          yAxisLabelWidth={Y_AXIS_WIDTH}
          yAxisTextStyle={styles.axisText}
          xAxisLabelTextStyle={styles.axisText}
          rulesColor={COLORS.gray100}
          rulesThickness={1}
          isAnimated
          animationDuration={800}
        />
      ) : null}
    </View>
  );
};

export default React.memo(RegenTrendChart);

const styles = StyleSheet.create({
  wrap: {
    minHeight: CHART_HEIGHT,
    overflow: 'hidden',
  },
  axisText: {
    ...presets.caption,
    color: COLORS.gray500,
  },
});
