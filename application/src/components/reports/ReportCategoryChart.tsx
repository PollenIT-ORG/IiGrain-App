import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { COLORS, presets } from '../../constants';
import { moderateScale, scale } from '../../utils';

export interface CategoryDatum {
  id: string;
  label: string;
  value: number;
  color: string;
}

export interface ReportCategoryChartProps {
  data: CategoryDatum[];
}

const Y_AXIS_WIDTH = scale(30);
const CHART_HEIGHT = scale(180);

/** Category names are long ("Carbon & Nutrient Cycling") and the axis has one
 *  slot per bar, so the axis carries the first word and the full name is left to
 *  the score list underneath. */
const shortLabel = (label: string): string => label.trim().split(/\s+/)[0] ?? label;

const ReportCategoryChart: React.FC<ReportCategoryChartProps> = ({ data }) => {
  const [containerW, setContainerW] = useState(0);

  const plotWidth = containerW > 0 ? containerW - Y_AXIS_WIDTH - scale(6) : 0;

  // Bars are sized to fill the card whatever the category count is, so the chart
  // never leaves a gap or overflows when categories are added or removed.
  const slot = data.length > 0 ? (plotWidth - scale(12)) / data.length : 0;
  const barWidth = Math.max(scale(14), slot * 0.55);
  const spacing = Math.max(scale(6), slot - barWidth);

  const chartData = data.map(c => ({
    value: c.value,
    label: shortLabel(c.label),
    frontColor: c.color,
    topLabelComponent: undefined,
  }));

  return (
    <View style={styles.wrap} onLayout={e => setContainerW(e.nativeEvent.layout.width)}>
      {plotWidth > 0 && data.length > 0 ? (
        <BarChart
          data={chartData}
          height={CHART_HEIGHT}
          width={plotWidth}
          barWidth={barWidth}
          spacing={spacing}
          initialSpacing={scale(12)}
          maxValue={100}
          noOfSections={4}
          barBorderTopLeftRadius={scale(6)}
          barBorderTopRightRadius={scale(6)}
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
          animationDuration={900}
        />
      ) : null}
    </View>
  );
};

export default React.memo(ReportCategoryChart);

const styles = StyleSheet.create({
  wrap: {
    minHeight: CHART_HEIGHT,
    overflow: 'hidden',
  },
  axisText: {
    ...presets.caption,
    color: COLORS.gray500,
    fontSize: moderateScale(10),
  },
});
