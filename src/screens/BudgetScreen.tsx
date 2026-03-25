import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Typography } from '../theme/Theme';
import { Ionicons } from '@expo/vector-icons';

interface Expense {
  id: string;
  title: string;
  amount: number;
  date: string;
}

export default function BudgetScreen() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [budgetLimit, setBudgetLimit] = useState('1000');
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const storedExpenses = await AsyncStorage.getItem('@daily_expenses');
      if (storedExpenses) setExpenses(JSON.parse(storedExpenses));
      
      const storedLimit = await AsyncStorage.getItem('@budget_limit');
      if (storedLimit) setBudgetLimit(storedLimit);
    } catch(e) {}
  };

  const saveExpenses = async (newExpenses: Expense[]) => {
    setExpenses(newExpenses);
    try {
      await AsyncStorage.setItem('@daily_expenses', JSON.stringify(newExpenses));
    } catch(e) {}
  };

  const saveBudget = async () => {
    setIsEditingBudget(false);
    try {
      await AsyncStorage.setItem('@budget_limit', budgetLimit);
    } catch(e) {}
  };

  const addExpense = () => {
    const cost = parseFloat(amount);
    if (title.trim() && !isNaN(cost) && cost > 0) {
      const newExpense: Expense = {
        id: Date.now().toString(),
        title: title.trim(),
        amount: cost,
        date: new Date().toLocaleDateString()
      };
      saveExpenses([newExpense, ...expenses]);
      setTitle('');
      setAmount('');
    } else {
      Alert.alert("Invalid Input", "Please enter a valid descriptive title and numeric cost snippet.");
    }
  };

  const deleteExpense = (id: string) => {
    Alert.alert("Remove Expense", "Remove this record?", [
       { text: "Cancel", style: "cancel" },
       { text: "Delete", style: "destructive", onPress: () => saveExpenses(expenses.filter(e => e.id !== id)) }
    ])
  };

  const totalSpent = expenses.reduce((sum, item) => sum + item.amount, 0);
  const remaining = parseFloat(budgetLimit) - totalSpent;
  const isOverBudget = remaining < 0;

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Budget Tracker</Text>

      <View style={styles.summaryCard}>
        <View style={styles.rowBetween}>
          <Text style={{...Typography.body, color: Colors.textSecondary}}>Total Spended</Text>
          {isEditingBudget ? (
            <TextInput 
               style={styles.budgetEdit} 
               value={budgetLimit} 
               onChangeText={setBudgetLimit} 
               keyboardType="numeric" 
               onBlur={saveBudget}
               autoFocus
            />
          ) : (
            <TouchableOpacity onPress={() => setIsEditingBudget(true)}>
               <Text style={{...Typography.caption, color: Colors.primary}}>Limit: ${budgetLimit} <Ionicons name="pencil" /></Text>
            </TouchableOpacity>
          )}
        </View>
        <Text style={styles.totalText}>${totalSpent.toFixed(2)}</Text>
        
        <View style={styles.balanceBadge}>
          <Ionicons name={isOverBudget ? "warning" : "checkmark-circle"} size={18} color={isOverBudget ? Colors.accent : Colors.secondary} />
          <Text style={{...Typography.body, color: isOverBudget ? Colors.accent : Colors.secondary, fontWeight: 'bold', marginLeft: 8}}>
            {isOverBudget ? `Over limit by $${Math.abs(remaining).toFixed(2)}` : `$${remaining.toFixed(2)} remaining`}
          </Text>
        </View>
      </View>

      <View style={styles.inputContainer}>
        <View style={{flex: 1, marginRight: 10}}>
          <TextInput
            style={styles.input}
            placeholder="Expense title..."
            placeholderTextColor={Colors.textMuted}
            value={title}
            onChangeText={setTitle}
          />
        </View>
        <View style={{width: 100, marginRight: 10}}>
          <TextInput
            style={styles.input}
            placeholder="$0.00"
            placeholderTextColor={Colors.textMuted}
            value={amount}
            keyboardType="decimal-pad"
            onChangeText={setAmount}
          />
        </View>
        <TouchableOpacity style={styles.addButton} onPress={addExpense}>
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={expenses}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.expenseItem} onLongPress={() => deleteExpense(item.id)}>
            <View style={styles.expenseIcon}>
               <Ionicons name="cart" size={20} color={Colors.primary} />
            </View>
            <View style={{flex: 1}}>
              <Text style={styles.expenseTitle}>{item.title}</Text>
              <Text style={{...Typography.caption, fontSize: 11}}>{item.date}</Text>
            </View>
            <Text style={styles.expenseAmount}>-${item.amount.toFixed(2)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={<Text style={{color: Colors.textMuted, textAlign: 'center', marginTop: 50}}>No expenses logged yet!</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: 20, paddingTop: 60 },
  header: { ...Typography.header, marginBottom: 20 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  summaryCard: { backgroundColor: Colors.surface, padding: 20, borderRadius: 20, marginBottom: 25, borderWidth: 1, borderColor: Colors.border },
  totalText: { ...Typography.header, fontSize: 40, marginTop: 10, letterSpacing: 1 },
  balanceBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 15, backgroundColor: Colors.surfaceHighlight, padding: 10, borderRadius: 10, alignSelf: 'flex-start' },
  budgetEdit: { backgroundColor: Colors.background, color: Colors.primary, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: Colors.primary, width: 80, textAlign: 'center' },

  inputContainer: { flexDirection: 'row', marginBottom: 25 },
  input: { backgroundColor: Colors.surface, color: Colors.text, padding: 15, borderRadius: 12, fontSize: 14, borderWidth: 1, borderColor: Colors.border },
  addButton: { backgroundColor: Colors.primary, padding: 15, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  
  expenseItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surfaceHighlight, padding: 15, borderRadius: 16, marginBottom: 12 },
  expenseIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
  expenseTitle: { ...Typography.title, fontSize: 16, marginBottom: 3 },
  expenseAmount: { ...Typography.body, fontWeight: '700', color: Colors.text }
});
