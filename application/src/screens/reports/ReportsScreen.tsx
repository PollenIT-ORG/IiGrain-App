import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { useNavigation, useRoute, type RouteProp } from '@react-navigation/native';
import { AppDropdown, AppHeader, AppText } from '../../components';
import { FadeSlideIn } from '../../components/home';
import { RegenTrendChart, ReportScoreBar } from '../../components/reports';
import { metricColor } from '../home/dashboardPresenters';
import { useAppSelector } from '../../redux/hooks';
import {
  selectDashboardFarms,
  selectSelectedFarmId,
} from '../../redux/slices/dashboardSlice';
import type { AppStackParamList } from '../../navigation/navigationTypes';
import { LATEST_YEAR, REPORT_YEARS, getFarmReport } from './reportsData';
import { styles } from './ReportsScreenStyle';

const YEAR_OPTIONS = REPORT_YEARS.map(y => ({ value: String(y), label: String(y) }));

const ReportsScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<AppStackParamList, 'Reports'>>();
  const farms = useAppSelector(selectDashboardFarms);
  const dashboardFarmId = useAppSelector(selectSelectedFarmId);

  const [selectedFarmId, setSelectedFarmId] = useState<string | null>(
    route.params?.farmId ?? dashboardFarmId ?? farms[0]?.id ?? null,
  );
  const [selectedYear, setSelectedYear] = useState<number>(LATEST_YEAR);

  const report = useMemo(() => getFarmReport(selectedYear), [selectedYear]);
  const farmOptions = useMemo(
    () => farms.map(f => ({ value: f.id, label: f.name })),
    [farms],
  );

  return (
    <View style={styles.safe}>
      <AppHeader variant="back" title="Reports" onBack={() => navigation.goBack()} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <FadeSlideIn>
          <View style={styles.filters}>
            <View style={styles.filterCol}>
              <AppDropdown
                value={String(selectedYear)}
                options={YEAR_OPTIONS}
                onSelect={v => setSelectedYear(Number(v))}
                placeholder="Year"
              />
            </View>
            <View style={styles.filterCol}>
              <AppDropdown
                value={selectedFarmId}
                options={farmOptions}
                onSelect={setSelectedFarmId}
                placeholder="Farm"
              />
            </View>
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={80} style={styles.section}>
          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Regen Health Index Trend</AppText>
            <RegenTrendChart data={report.trend} selectedYear={selectedYear} />
          </View>
        </FadeSlideIn>

        <FadeSlideIn delay={160} style={styles.section}>
          <View style={styles.card}>
            <AppText style={styles.cardTitle}>Category Scores</AppText>
            <View style={styles.bars}>
              {report.categories.map((c, index) => (
                <ReportScoreBar
                  key={c.id}
                  label={c.label}
                  value={c.value}
                  color={metricColor(index)}
                  delay={220 + index * 80}
                />
              ))}
            </View>
          </View>
        </FadeSlideIn>
      </ScrollView>
    </View>
  );
};

export default ReportsScreen;
