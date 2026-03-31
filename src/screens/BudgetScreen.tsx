import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SectionList,
  TextInput,
  Modal,
  Dimensions,
  Platform,
  StatusBar,
  KeyboardAvoidingView,
  ScrollView,
  FlatList,
  Pressable,
  Animated,
  Easing
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Typography, Shadows, Spacing } from '../theme/Theme';
import { scaleFontSize } from '../utils/ResponsiveSize';
import { useTheme } from '../context/ThemeContext';

const { width } = Dimensions.get('window');

interface Transaction {
  id: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  date: string;
  comment?: string;
}

const CATEGORIES = {
  expense: [
    { name: 'Food', icon: 'fast-food-outline' },
    { name: 'Transport', icon: 'car-outline' },
    { name: 'Shopping', icon: 'cart-outline' },
    { name: 'Bills', icon: 'receipt-outline' },
    { name: 'Entertainment', icon: 'game-controller-outline' },
    { name: 'Others', icon: 'ellipsis-horizontal-outline' }
  ],
  income: [
    { name: 'Salary', icon: 'cash-outline' },
    { name: 'Freelance', icon: 'laptop-outline' },
    { name: 'Gift', icon: 'gift-outline' },
    { name: 'Others', icon: 'ellipsis-horizontal-outline' }
  ]
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Generate years from 2020 to current year + 1
const START_YEAR = 2020;
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - START_YEAR + 2 }, (_, i) => (START_YEAR + i).toString()).reverse();

export default function BudgetScreen() {
  const { colors, isDark } = useTheme();
  const isFocused = useIsFocused();

  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [isAdding, setIsAdding] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [tempBudgetLimit, setTempBudgetLimit] = useState('');

  // Filters
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()]);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [category, setCategory] = useState('Others');
  const [comment, setComment] = useState('');
  const [amountError, setAmountError] = useState('');

  // Animation refs
  const summaryCardAnim = useRef(new Animated.Value(0)).current;
  const transactionListAnim = useRef(new Animated.Value(0)).current;
  const fabScaleAnim = useRef(new Animated.Value(0.8)).current;
  const amountShakeAnim = useRef(new Animated.Value(0)).current;

  // Custom alert state
  const [alertConfig, setAlertConfig] = useState<{ title: string; message: string; buttons: { text: string; onPress?: () => void; destructive?: boolean }[]; visible: boolean } | null>(null);

  // Custom alert handler
  const showAlert = (title: string, message: string, buttons?: { text: string; onPress?: () => void; destructive?: boolean }[]) => {
    setAlertConfig({
      title,
      message,
      buttons: buttons || [{ text: 'OK' }],
      visible: true,
    });
  };

  const closeAlert = () => {
    setAlertConfig(null);
  };

  const currentBudgetLimit = budgets[`${selectedMonth}-${selectedYear}`] || 10000;

  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: {
      paddingHorizontal: 24,
      paddingTop: Platform.OS === 'ios' ? 60 : 40,
      paddingBottom: 24,
    },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    title: { ...Typography.header, fontSize: scaleFontSize(32), color: colors.text },
    filterTrigger: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderRadius: 14,
      ...Shadows.soft,
      gap: 8,
    },
    filterText: { ...Typography.body, fontSize: scaleFontSize(15), fontWeight: '700', color: colors.text },
    
    summaryCard: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      padding: 24,
      ...Shadows.soft,
      marginBottom: 24,
      overflow: 'hidden',
    },
    summaryLabel: { ...Typography.caption, color: colors.textVariant, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
    balanceText: { ...Typography.header, fontSize: scaleFontSize(42), color: colors.text, marginBottom: 20 },
    statsRow: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: colors.background, paddingTop: 20 },
    statItem: { flex: 1, alignItems: 'center' },
    statLabel: { ...Typography.caption, color: colors.textVariant, marginBottom: 4 },
    statValue: { ...Typography.title, fontSize: scaleFontSize(18), fontWeight: '800' },
    divider: { width: 1, height: '100%', backgroundColor: colors.background, marginHorizontal: 12 },

    sectionHeader: {
      backgroundColor: colors.background,
      paddingHorizontal: 24,
      paddingVertical: 12,
    },
    sectionTitle: { ...Typography.caption, fontWeight: '800', color: colors.textVariant, letterSpacing: 1 },

    transactionCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: 24,
      marginBottom: 12,
      padding: 16,
      borderRadius: 20,
      ...Shadows.soft,
    },
    iconContainer: {
      width: 48,
      height: 48,
      borderRadius: 16,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    txInfo: { flex: 1 },
    txCategory: { ...Typography.title, fontSize: scaleFontSize(16), color: colors.text },
    txComment: { ...Typography.caption, color: colors.textVariant, marginTop: 2 },
    txAmount: { ...Typography.title, fontSize: scaleFontSize(17), fontWeight: '800' },

    fab: {
      position: 'absolute',
      bottom: 30,
      right: 24,
      width: 64,
      height: 64,
      borderRadius: 24,
      ...Shadows.soft,
      overflow: 'hidden',
    },
    fabGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15,14,23,0.6)', justifyContent: 'flex-end' },
    sheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 36,
      borderTopRightRadius: 36,
      padding: 32,
      paddingBottom: Platform.OS === 'ios' ? 44 : 32,
    },
    sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 28 },
    sheetTitle: { ...Typography.header, fontSize: scaleFontSize(24), color: colors.text },
    
    typeToggle: { flexDirection: 'row', backgroundColor: colors.background, padding: 4, borderRadius: 16, marginBottom: 28 },
    typeBtn: { flex: 1, paddingVertical: 12, alignItems: 'center', borderRadius: 12 },
    typeBtnActive: { backgroundColor: colors.surface, ...Shadows.soft },
    typeText: { ...Typography.body, fontWeight: '700', color: colors.textVariant },
    typeTextActive: { color: colors.primary },

    inputLabel: { ...Typography.caption, fontWeight: '800', color: colors.textVariant, marginBottom: 12, letterSpacing: 1 },
    amountInput: {
      ...Typography.header,
      fontSize: scaleFontSize(48),
      color: colors.text,
      textAlign: 'center',
      marginBottom: 28,
    },
    commentInput: {
      backgroundColor: colors.background,
      borderRadius: 16,
      padding: 16,
      ...Typography.body,
      color: colors.text,
      marginBottom: 28,
    },
    categoryList: { marginBottom: 28 },
    catItem: { alignItems: 'center', marginBottom: 16, flex: 1, maxWidth: '25%' },
    catIconBox: {
      width: 44,
      height: 44,
      borderRadius: 16,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 6,
    },
    catIconBoxActive: { backgroundColor: colors.primary },
    catName: { ...Typography.caption, fontSize: scaleFontSize(11), fontWeight: '700', textAlign: 'center' },
    errorText: { ...Typography.caption, color: colors.error, marginTop: 8, textAlign: 'center' },

    submitBtn: {
      backgroundColor: colors.primary,
      paddingVertical: 18,
      borderRadius: 18,
      alignItems: 'center',
      ...Shadows.soft,
    },
    submitBtnText: { color: '#FFF', fontWeight: '800', fontSize: scaleFontSize(17) },
    inputGroup: { marginBottom: 28 },
    amountInputRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
    currency: { ...Typography.header, fontSize: scaleFontSize(48), color: colors.textVariant, marginRight: 8 },
    monthCard: {
      width: '30%',
      aspectRatio: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 20,
      marginBottom: 12,
      ...Shadows.soft,
    },
    emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 100 },
    emptyText: { ...Typography.body, color: colors.textVariant, marginTop: 16 },
  });

  useEffect(() => {
    loadData();
    startAnimations();
  }, [isFocused]);

  const startAnimations = () => {
    summaryCardAnim.setValue(0);
    transactionListAnim.setValue(0);
    fabScaleAnim.setValue(0.8);

    Animated.stagger(150, [
      Animated.timing(summaryCardAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(transactionListAnim, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(fabScaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.back(1.2)),
        useNativeDriver: true,
      }),
    ]).start();
  };

  const loadData = async () => {
    try {
      const stored = await AsyncStorage.getItem('@daily_expenses_v2');
      const storedBudgets = await AsyncStorage.getItem('@budget_limits_v3');
      const oldLimit = await AsyncStorage.getItem('@budget_limit_v2');

      if (stored) setTransactions(JSON.parse(stored));

      let budgetsObj: Record<string, number> = {};
      if (storedBudgets) {
        budgetsObj = JSON.parse(storedBudgets);
      } else if (oldLimit) {
        const currentKey = `${MONTHS[new Date().getMonth()]}-${new Date().getFullYear()}`;
        budgetsObj[currentKey] = parseFloat(oldLimit);
      }
      setBudgets(budgetsObj);
    } catch (e) {}
  };

  const saveData = async (txs: Transaction[], bgs?: Record<string, number>) => {
    try {
      setTransactions(txs);
      await AsyncStorage.setItem('@daily_expenses_v2', JSON.stringify(txs));
      if (bgs) {
        await AsyncStorage.setItem('@budget_limits_v3', JSON.stringify(bgs));
      }
    } catch (e) {}
  };

  const addTransaction = () => {
    const val = parseFloat(amount);
    if (!val || val <= 0) {
      setAmountError('Please enter a valid amount');
      triggerShake();
      return;
    }

    const newTx: Transaction = {
      id: Date.now().toString(),
      amount: val,
      category,
      type,
      date: new Date().toISOString(),
      comment: comment.trim() || undefined
    };

    saveData([newTx, ...transactions]);
    setAmount('');
    setComment('');
    setCategory('Others');
    setAmountError('');
    setIsAdding(false);
  };

  const triggerShake = () => {
    const shakeSequence = [
      Animated.timing(amountShakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(amountShakeAnim, {
        toValue: 10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(amountShakeAnim, {
        toValue: -10,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(amountShakeAnim, {
        toValue: 0,
        duration: 50,
        useNativeDriver: true,
      }),
    ];

    Animated.sequence(shakeSequence).start();
  };

  const deleteTransaction = (id: string) => {
    saveData(transactions.filter(t => t.id !== id));
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
      const d = new Date(t.date);
      return MONTHS[d.getMonth()] === selectedMonth && d.getFullYear().toString() === selectedYear;
    });
  }, [transactions, selectedMonth, selectedYear]);

  const totalExpenses = filteredTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalIncome = filteredTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = currentBudgetLimit - totalExpenses + totalIncome;
  const progress = Math.min(totalExpenses / currentBudgetLimit, 1);

  const totals = { income: totalIncome, expense: totalExpenses };
  const sections = useMemo(() => {
    const groups = filteredTransactions.reduce((acc: any, t) => {
      const date = new Date(t.date).toLocaleDateString();
      const found = acc.find((g: any) => g.title === date);
      if (found) found.data.push(t);
      else acc.push({ title: date, data: [t] });
      return acc;
    }, []);
    return groups;
  }, [filteredTransactions]);

  const updateBudgetLimit = (limit: number) => {
    const key = `${selectedMonth}-${selectedYear}`;
    const newBudgets = { ...budgets, [key]: limit };
    setBudgets(newBudgets);
    saveData(transactions, newBudgets);
  };

  return (
    <View style={styles.container}>
      <View style={{ height: 30 }} />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>History</Text>
          <TouchableOpacity 
            style={styles.filterTrigger}
            onPress={() => setIsPickerOpen(true)}
          >
            <Text style={styles.filterText}>{selectedMonth} {selectedYear}</Text>
            <Ionicons name="chevron-down" size={16} color={colors.text} />
          </TouchableOpacity>
        </View>

        <Animated.View style={[
          styles.summaryCard,
          {
            opacity: summaryCardAnim,
            transform: [{
              scale: summaryCardAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.95, 1],
              })
            }]
          }
        ]}>
          <Text style={styles.summaryLabel}>REMAINING BUDGET</Text>
          <Text style={[styles.balanceText, { color: (currentBudgetLimit - totals.expense) < 0 ? colors.error : colors.text }]}>
            ₹{(currentBudgetLimit - totals.expense).toFixed(0)}
          </Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Income</Text>
              <Text style={[styles.statValue, { color: colors.tertiary }]}>+₹{totals.income.toFixed(0)}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Spent</Text>
              <Text style={[styles.statValue, { color: colors.error }]}>-₹{totals.expense.toFixed(0)}</Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.statItem} onPress={() => {
              setTempBudgetLimit(Math.floor(currentBudgetLimit).toString());
              setIsSettingsOpen(true);
            }}>
              <Text style={styles.statLabel}>Limit</Text>
              <View style={{flexDirection: 'row', alignItems: 'center', gap: 4}}>
                <Text style={styles.statValue}>₹{currentBudgetLimit.toFixed(0)}</Text>
                <Ionicons name="pencil" size={12} color={colors.textVariant} />
              </View>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={t => t.id}
        renderSectionHeader={({ section: { title } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.transactionCard}
            onLongPress={() => {
              showAlert('Delete Entry', 'Remove this transaction?', [
                { text: 'Cancel' },
                { text: 'Delete', destructive: true, onPress: () => deleteTransaction(item.id) }
              ]);
            }}
          >
            <View style={[styles.iconContainer, { backgroundColor: item.type === 'expense' ? colors.error + '15' : colors.tertiary + '15' }]}>
              <Ionicons 
                name={(CATEGORIES[item.type as 'expense' | 'income']).find((c: any) => c.name === item.category)?.icon as any || 'help'} 
                size={22} 
                color={item.type === 'expense' ? colors.error : colors.tertiary} 
              />
            </View>
            <View style={styles.txInfo}>
              <Text style={styles.txCategory}>{item.category}</Text>
              {item.comment ? <Text style={styles.txComment}>{item.comment}</Text> : null}
            </View>
            <Text style={[styles.txAmount, { color: item.type === 'expense' ? colors.error : colors.tertiary }]}>
              {item.type === 'expense' ? '-' : '+'}₹{item.amount.toFixed(0)}
            </Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={64} color={isDark ? colors.surfaceContainer : "#E0E0EF"} />
            <Text style={styles.emptyText}>No transactions for this period</Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 100 }}
      />

      <Animated.View style={[
        styles.fab,
        {
          transform: [{
            scale: fabScaleAnim
          }]
        }
      ]}>
        <TouchableOpacity style={{flex: 1}} onPress={() => setIsAdding(true)}>
          <LinearGradient colors={[colors.primary, colors.primaryLight]} style={styles.fabGradient}>
            <Ionicons name="add" size={32} color="#FFF" />
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* Add Transaction Modal */}
      <Modal visible={isAdding} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
           <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>New Entry</Text>
                <TouchableOpacity onPress={() => setIsAdding(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.typeToggle}>
                 <TouchableOpacity 
                   style={[styles.typeBtn, type === 'expense' && styles.typeBtnActive]} 
                   onPress={() => { setType('expense'); setCategory(CATEGORIES.expense[0].name); }}
                 >
                   <Text style={[styles.typeText, type === 'expense' && styles.typeTextActive]}>Expense</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                   style={[styles.typeBtn, type === 'income' && styles.typeBtnActive]} 
                   onPress={() => { setType('income'); setCategory(CATEGORIES.income[0].name); }}
                 >
                   <Text style={[styles.typeText, type === 'income' && styles.typeTextActive]}>Income</Text>
                 </TouchableOpacity>
              </View>

              <View style={styles.amountInputRow}>
                <Animated.View style={{
                  transform: [{ translateX: amountShakeAnim }],
                }}>
                  <TextInput
                    style={styles.amountInput}
                    placeholder="0"
                    placeholderTextColor={colors.textVariant}
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={(text) => {
                      setAmount(text);
                      if (amountError) setAmountError('');
                    }}
                    maxLength={10}
                    autoFocus
                  />
                </Animated.View>
              </View>
              {amountError && <Text style={styles.errorText}>{amountError}</Text>}

              <View style={styles.categoryList}>
                <Text style={styles.inputLabel}>CATEGORY</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', width: '100%' }}>
                  {CATEGORIES[type].map((item) => (
                    <TouchableOpacity 
                      key={item.name}
                      style={styles.catItem}
                      onPress={() => setCategory(item.name)}
                    >
                      <View style={[styles.catIconBox, category === item.name && { backgroundColor: type === 'expense' ? colors.error : colors.tertiary }]}>
                        <Ionicons name={item.icon as any} size={20} color={category === item.name ? '#FFF' : colors.text} />
                      </View>
                      <Text style={[styles.catName, { color: category === item.name ? colors.primary : colors.textVariant }]}>{item.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>NOTES</Text>
                <TextInput
                  style={styles.commentInput}
                  placeholder="What was this for?"
                  placeholderTextColor={colors.textVariant}
                  value={comment}
                  onChangeText={setComment}
                />
              </View>

              <TouchableOpacity style={styles.submitBtn} onPress={addTransaction}>
                <Text style={styles.submitBtnText}>Add Transaction</Text>
              </TouchableOpacity>
            </View>
           </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* Period Picker Modal */}
      <Modal visible={isPickerOpen} transparent animationType="fade">
         <View style={styles.modalOverlay}>
            <View style={[styles.sheet, { maxHeight: '80%' }]}>
              <Text style={[styles.sheetTitle, { marginBottom: 20 }]}>Select Period</Text>
              <ScrollView>
                <Text style={styles.inputLabel}>YEAR</Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 20}}>
                  {YEARS.map(y => (
                    <TouchableOpacity 
                      key={y} 
                      style={[styles.filterTrigger, selectedYear === y && { backgroundColor: colors.primary }]}
                      onPress={() => setSelectedYear(y)}
                    >
                      <Text style={[styles.filterText, selectedYear === y && { color: '#FFF' }]}>{y}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.inputLabel}>MONTH</Text>
                <View style={{flexDirection: 'row', flexWrap: 'wrap', gap: 8}}>
                  {MONTHS.map(m => (
                    <TouchableOpacity 
                      key={m} 
                      style={[styles.monthCard, selectedMonth === m && { backgroundColor: colors.primary }]}
                      onPress={() => setSelectedMonth(m)}
                    >
                      <Text style={[styles.filterText, selectedMonth === m && { color: '#FFF' }]}>{m}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <TouchableOpacity 
                style={[styles.submitBtn, { marginTop: 24 }]} 
                onPress={() => setIsPickerOpen(false)}
              >
                <Text style={styles.submitBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
         </View>
      </Modal>

      {/* Budget Settings Modal */}
      <Modal visible={isSettingsOpen} transparent animationType="fade">
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={[styles.modalOverlay, { justifyContent: 'center', padding: 24 }]}>
            <View style={[styles.sheet, { borderRadius: 28 }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Text style={styles.sheetTitle}>Set Budget Limit</Text>
                <TouchableOpacity onPress={() => setIsSettingsOpen(false)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              <Text style={[styles.txComment, { marginBottom: 20 }]}>For {selectedMonth} {selectedYear}</Text>
              <View style={styles.amountInputRow}>
                <Text style={styles.currency}>₹</Text>
                <TextInput
                  style={[styles.amountInput, { fontSize: scaleFontSize(48) }]}
                  value={tempBudgetLimit}
                  keyboardType="numeric"
                  onChangeText={setTempBudgetLimit}
                  maxLength={10}
                  autoFocus
                />
              </View>
              <TouchableOpacity style={styles.submitBtn} onPress={() => {
                updateBudgetLimit(parseFloat(tempBudgetLimit) || 0);
                setIsSettingsOpen(false);
              }}>
                <Text style={styles.submitBtnText}>Save Limit</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ═══ Custom Alert Modal ═══ */}
      {alertConfig?.visible && (
        <Modal visible={alertConfig.visible} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 }}>
            <View style={{ backgroundColor: colors.surface, borderRadius: 20, padding: 24, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12, maxWidth: '90%' }}>
              {/* Title */}
              <Text style={{ fontSize: scaleFontSize(18), fontWeight: '800', color: colors.text, marginBottom: 8 }}>
                {alertConfig.title}
              </Text>
              {/* Message */}
              <Text style={{ fontSize: scaleFontSize(15), color: colors.textVariant, lineHeight: 22, marginBottom: 24 }}>
                {alertConfig.message}
              </Text>
              {/* Buttons */}
              <View style={{ gap: 10 }}>
                {alertConfig.buttons.map((btn, idx) => (
                  <TouchableOpacity
                    key={idx}
                    style={{
                      paddingHorizontal: 16,
                      paddingVertical: 14,
                      borderRadius: 12,
                      backgroundColor: btn.destructive ? colors.error : btn.text === 'OK' || btn.text === 'Cancel' ? colors.background : colors.primary,
                      justifyContent: 'center',
                      alignItems: 'center',
                    }}
                    onPress={() => {
                      btn.onPress?.();
                      closeAlert();
                    }}
                  >
                    <Text style={{ fontSize: scaleFontSize(15), fontWeight: '700', color: btn.destructive || (btn.text !== 'OK' && btn.text !== 'Cancel') ? '#FFF' : colors.text }}>
                      {btn.text}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}
