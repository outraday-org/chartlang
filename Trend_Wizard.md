// This source code is subject to the terms of the Mozilla Public License 2.0 at https://mozilla.org/MPL/2.0/
// © TradeRational

//@version=6
indicator("Trend Wizard v1.0", shorttitle = "Trend Wizard v1.0", overlay = false)

// INPUTS ------------------------------------------------------------------------------------------------------------------------------------------------------

menue_0 = "Table"
string src_tframe   = input.timeframe("", "Timeframe", group = menue_0, inline = "1", tooltip = "Choose Timeframe used for indicator.")
src_symbol_custom   = input.symbol("NASDAQ:QQQ", "", group = menue_0, inline = "2", tooltip = "Choose custom symbol for reference.")
src_symbol_swtch    = input.bool(false, "Use Custom Symbol", group = menue_0, inline = "2", tooltip = "Use custom symbol rather than chart symbol.")

menue_1 = "Display"
outputs             = input.bool(true, "Table Outputs", group = menue_1, inline = "6")
tab_inv             = input.bool(true, "Plot invisible", group = menue_1, inline = "6")
tab_out_1           = input.bool(true, "Trend", group = menue_1, inline = "7")
tab_out_2           = input.bool(false, "T2", group = menue_1, inline = "7")
tab_out_3           = input.bool(false, "T3", group = menue_1, inline = "7")
tab_out_4           = input.bool(false, "T4", group = menue_1, inline = "7")

tab_short           = input.bool(true, "Short", group = menue_1, inline = "8")
tab_med             = input.bool(false, "Medium", group = menue_1, inline = "8")
tab_long            = input.bool(false, "Long", group = menue_1, inline = "8")

menue_1_1 = "Indicator"
preset_select     = input.string("Trade Rational Default", "Preset", options = ["Trade Rational Default", "Swing Trading", "Swing Trader Deluxe"], group = menue_1_1, inline = "1")
custom_ma_swtch   = input.bool(true, "Overwrite Preset with Settings Below", group = menue_1_1, inline = "3")

ma_1_lgth_custom = input.int(8, "MA 1", group = menue_1_1, inline = "4")
ma_2_lgth_custom = input.int(21, "MA 2", group = menue_1_1, inline = "5")
ma_3_lgth_custom = input.int(50, "MA 3", group = menue_1_1, inline = "6")
ma_4_lgth_custom = input.int(145, "MA 4", group = menue_1_1, inline = "7")
ma_5_lgth_custom = input.int(241, "MA 5", group = menue_1_1, inline = "8")

ma_1_type_custom = input.string("EMA", "", options = ["SMA", "EMA"], group = menue_1_1, inline = "4")
ma_2_type_custom = input.string("EMA", "", options = ["SMA", "EMA"], group = menue_1_1, inline = "5")
ma_3_type_custom = input.string("SMA", "", options = ["SMA", "EMA"], group = menue_1_1, inline = "6")
ma_4_type_custom = input.string("SMA", "", options = ["SMA", "EMA"], group = menue_1_1, inline = "7")
ma_5_type_custom = input.string("SMA", "", options = ["SMA", "EMA"], group = menue_1_1, inline = "8")

menue_1_2 = "__________________Development Elements__________________"
ma_slopes_swtch     = input.bool(false, "MA Slopes", group = menue_1_2, inline = "1")
ma_deriv_swtch      = input.bool(false, "MA Derivatives", group = menue_1_2, inline = "1")
ma_turnover_swtch   = input.bool(false, "MA Turnovers", group = menue_1_2, inline = "1")
ma_dist_swtch       = input.bool(false, "MA Distances", group = menue_1_2, inline = "2")
ma_cross_swtch      = input.bool(false, "MA Crossings", group = menue_1_2, inline = "2")
rsi_swtch           = input.bool(false, "RSI", group = menue_1_2, inline = "3")

atr_short_swtch     = input.bool(false, "ATR Short", group = menue_1_2, inline = "4")
atr_med_swtch       = input.bool(false, "ATR Medium", group = menue_1_2, inline = "4")
atr_long_swtch      = input.bool(false, "ATR Long", group = menue_1_2, inline = "4")
atr_distadj_swtch   = input.bool(true, "Adj Dist", group = menue_1_2, inline = "4")
zero_line_swtch     = input.bool(true, "Zero Line", group = menue_1_2, inline = "5")

menue_2 = "MA Slope"
ma1_swtch = input.bool(true, "MA 1", group = menue_2, inline = "1")
ma2_swtch = input.bool(true, "MA 2", group = menue_2, inline = "2")
ma3_swtch = input.bool(true, "MA 3", group = menue_2, inline = "3")
ma4_swtch = input.bool(true, "MA 4", group = menue_2, inline = "4")
ma5_swtch = input.bool(true, "MA 5", group = menue_2, inline = "5")

ma1_factor = input.int(1, "÷", group = menue_2, inline = "1")
ma2_factor = input.int(1, "÷", group = menue_2, inline = "2")
ma3_factor = input.int(1, "÷", group = menue_2, inline = "3")
ma4_factor = input.int(1, "÷", group = menue_2, inline = "4")
ma5_factor = input.int(1, "÷", group = menue_2, inline = "5")

ma1_slope_smooth = input.int(2, "Smooth", group = menue_2, inline = "1")
ma2_slope_smooth = input.int(1, "Smooth", group = menue_2, inline = "2")
ma3_slope_smooth = input.int(2, "Smooth", group = menue_2, inline = "3")
ma4_slope_smooth = input.int(3, "Smooth", group = menue_2, inline = "4")
ma5_slope_smooth = input.int(3, "Smooth", group = menue_2, inline = "5")

ma_slope_comp_swtch     = input.bool(true, "Combine MA Slopes", group = menue_2, inline = "6")
ma_slope_comp_type      = input.string("SMA", "Comp MA Smooth", options = ["SMA", "EMA"], group = menue_2, inline = "7")
ma_slope_comp_smooth    = input.int(1, "", group = menue_2, inline= "7")

menue_3 = "MA Slope Derivative"
ma_slope_deriv_smooth   = input.int(3, "Deriv Smooth", group = menue_3, inline = "1")
ma_slope_deriv_scaling  = input.float(2.0, "Scale", group = menue_3, inline = "1", step = 0.25)
ma_slope_deriv_comp_swtch     = input.bool(true, "Combine Slope Derivatives", group = menue_3, inline = "1.5")
ma_slope_deriv_comp_type      = input.string("SMA", "Comp MA Smooth", options = ["SMA", "EMA"], group = menue_3, inline = "2")
ma_slope_deriv_comp_smooth    = input.int(21, "", group = menue_3, inline= "2")
ma_slope_deriv_comp_scaling   = input.float(5.0, "Scale Comp MA", group = menue_3, inline = "3", step = 0.5)

menue_4 = "MA Slope Turnover"
ma1_tover_swtch = input.bool(true, "MA 1 Turnover", group = menue_4, inline = "1")
ma2_tover_swtch = input.bool(true, "MA 2 Turnover", group = menue_4, inline = "2")
ma3_tover_swtch = input.bool(true, "MA 3 Turnover", group = menue_4, inline = "3")
ma4_tover_swtch = input.bool(true, "MA 4 Turnover", group = menue_4, inline = "4")
ma5_tover_swtch = input.bool(true, "MA 5 Turnover", group = menue_4, inline = "5")

ma1_tover_smooth = input.int(8, "Smooth", group = menue_4, inline = "1")
ma2_tover_smooth = input.int(8, "Smooth", group = menue_4, inline = "2")
ma3_tover_smooth = input.int(8, "Smooth", group = menue_4, inline = "3")
ma4_tover_smooth = input.int(8, "Smooth", group = menue_4, inline = "4")
ma5_tover_smooth = input.int(8, "Smooth", group = menue_4, inline = "5")

ma_tover_comp_swtch = input.bool(false, "Combine MA Turnovers", group = menue_4, inline = "6")
ma_tover_plot_type  = input.string("Line", "Plot Type", options = ["Line", "Histo"], group = menue_4, inline = "7")
ma_tover_scaling    = input.float(1.0, "Scale Turnovers", group = menue_4, inline = "8", step = 0.05)

menue_5 = "MA Distance"
ma1_dist_swtch = input.bool(true, "MA 1 Dist", group = menue_5, inline = "1")
ma2_dist_swtch = input.bool(true, "MA 2 Dist", group = menue_5, inline = "2")
ma3_dist_swtch = input.bool(true, "MA 3 Dist", group = menue_5, inline = "3")
ma4_dist_swtch = input.bool(true, "MA 4 Dist", group = menue_5, inline = "4")
ma5_dist_swtch = input.bool(true, "MA 5 Dist", group = menue_5, inline = "5")

ma1_dist_smooth = input.int(3, "Smooth", group = menue_5, inline = "1")
ma2_dist_smooth = input.int(4, "Smooth", group = menue_5, inline = "2")
ma3_dist_smooth = input.int(5, "Smooth", group = menue_5, inline = "3")
ma4_dist_smooth = input.int(8, "Smooth", group = menue_5, inline = "4")
ma5_dist_smooth = input.int(10, "Smooth", group = menue_5, inline = "5")

ma_dist_comp_swtch = input.bool(true, "Combine MA Distances", group = menue_5, inline = "6")
ma_dist_scaling    = input.float(0.1, "Scale Distances", group = menue_5, inline = "7", step = 0.01)

menue_6 = "MAs Crossing"
ma12_cross_swtch = input.bool(true, "1-2 Cross", group = menue_6, inline = "1")
ma23_cross_swtch = input.bool(false, "2-3 Cross", group = menue_6, inline = "2")
ma34_cross_swtch = input.bool(false, "3-4 Cross", group = menue_6, inline = "3")
ma45_cross_swtch = input.bool(false, "4-5 Cross", group = menue_6, inline = "4")

ma12_cross_smooth = input.int(1, "Smooth", group = menue_6, inline = "1")
ma23_cross_smooth = input.int(1, "Smooth", group = menue_6, inline = "2")
ma34_cross_smooth = input.int(1, "Smooth", group = menue_6, inline = "3")
ma45_cross_smooth = input.int(1, "Smooth", group = menue_6, inline = "4")

ma12_cross_excl   = input.string("2", "Excl", options = ["0", "1", "2"], group = menue_6, inline = "1")
ma23_cross_excl   = input.string("2", "Excl", options = ["0", "1", "2"], group = menue_6, inline = "2")
ma34_cross_excl   = input.string("2", "Excl", options = ["0", "1", "2"], group = menue_6, inline = "3")
ma45_cross_excl   = input.string("2", "Excl", options = ["0", "1", "2"], group = menue_6, inline = "4")

ma_cross_comp_swtch     = input.bool(false, "Combine MAs crossing", group = menue_6, inline = "5")
ma_cross_comp_smooth    = input.int(1, "Smooth", group = menue_6, inline= "5")
ma_cross_scaling        = input.float(1.0, "Scale Crossings", group = menue_6, inline = "7", step = 0.25)

menue_8 = "RSI - Relative Strength"
rsi_ma_length           = input.int(14, "RSI MA Length", group = menue_8, inline = "1")
rsi_ma_smooth           = input.int(4, "Smooth", group = menue_8, inline = "1")
rsi_plot_swtch          = input.bool(false, "RSI", group = menue_8, inline = "2")
rsi_ma_swtch            = input.bool(true, "RSI MA", group = menue_8, inline = "2")
rsi_ma_slope_swtch      = input.bool(false, "RSI MA Slope", group = menue_8, inline = "2")
rsi_scaling             = input.float(0.1, "Scale RSI", group = menue_8, inline = "4", step = 0.02)
rsi_ma_slope_scaling    = input.float(2.5, "Scale RSI MA Slope", group = menue_8, inline = "4", step = 0.25)
rsi_center              = input.bool(true, "Center RSI", group = menue_8, inline = "5")

menue_10 = "________________________TESTING________________________"
test_int_1      = input.int(1, "Test Int 1", group = menue_10, inline = "6")
test_int_2      = input.int(1, "Test Int 2", group = menue_10, inline = "6")
test_float_1    = input.float(1.0, "Test Float 1", group = menue_10, inline = "7", step = 0.25)
test_float_2    = input.float(0.0, "Test Float 2", group = menue_10, inline = "7", step = 0.05)
test_bool_1     = input.bool(true, "Test Bool 1", group = menue_10, inline = "8")
test_bool_2     = input.bool(true, "Test Bool 2", group = menue_10, inline = "8")
test_bool_3     = input.bool(true, "Test Bool 3", group = menue_10, inline = "8")

// VARIABLES ---------------------------------------------------------------------------------------------------------------------------------------------------

var int ma_1_lgth_preset = na
var int ma_2_lgth_preset = na
var int ma_3_lgth_preset = na
var int ma_4_lgth_preset = na
var int ma_5_lgth_preset = na

var string ma_1_type_preset = na
var string ma_2_type_preset = na
var string ma_3_type_preset = na
var string ma_4_type_preset = na
var string ma_5_type_preset = na

// FUNCTIONS ---------------------------------------------------------------------------------------------------------------------------------------------------

cf_slope (ma, smoothing_amt)        => ta.ema(((ma - ma[1]) / ma[1] * 100), smoothing_amt)

cf_dist (source, ma, smoothing_amt) => ta.sma(((source - ma) / ma * 100), smoothing_amt)

cf_macross (MA1, MA2, MA12_excl, ma12_cross_smooth, ma_type) =>
    ma_cross = ta.cross(MA1, MA2)
    float ma_cross_counter = 0.0
    ma_cross_counter := (ma_cross and not (MA12_excl == "1" ? ma_cross[1] : (MA12_excl == "2" ? (ma_cross[1] or ma_cross[2]) : false))) ? 1 : 0
    ma_cross_ma = ma_type == "SMA" ? ta.sma(ma_cross_counter, ma12_cross_smooth) : ta.ema(ma_cross_counter, ma12_cross_smooth)

cf_atr_perct (length) =>
    atr         = ta.atr(length)
    atr_prct    = (atr / close) * 100

cf_limit (input_val, upper_limit, lower_limit) =>
    input_limited = math.max(math.min(input_val, upper_limit), lower_limit)

cf_ma (input_val, ma_type, ma_lgth) => 
    float result = switch ma_type
        "SMA" => ta.sma(input_val, ma_lgth)
        "EMA" => ta.ema(input_val, ma_lgth)
        "WMA" => ta.wma(input_val, ma_lgth)
        "HMA" => ta.hma(input_val, ma_lgth)

// CALCULATIONS ------------------------------------------------------------------------------------------------------------------------------------------------

// Source Data
src_chart  = request.security (syminfo.tickerid,  src_tframe, close, gaps = barmerge.gaps_off)
src_custom = request.security (src_symbol_custom, src_tframe, close, gaps = barmerge.gaps_off)
src        = src_symbol_swtch ? src_custom : src_chart

[src_custom_hi, src_custom_lo] = request.security(src_symbol_custom, src_tframe, [high, low])
src_hi = src_symbol_swtch ? src_custom_hi : high
src_lo = src_symbol_swtch ? src_custom_lo : low

// Moving Averages
switch preset_select
    "Trade Rational Default" => ma_1_lgth_preset := 8, ma_2_lgth_preset := 21, ma_3_lgth_preset := 50, ma_4_lgth_preset := 145, ma_5_lgth_preset := 241, ma_1_type_preset := "EMA", ma_2_type_preset := "EMA", ma_3_type_preset := "SMA", ma_4_type_preset := "SMA", ma_5_type_preset := "SMA"
    "Swing Trading"          => ma_1_lgth_preset := 4, ma_2_lgth_preset := 10, ma_3_lgth_preset := 25, ma_4_lgth_preset := 50, ma_5_lgth_preset := 100, ma_1_type_preset := "EMA", ma_2_type_preset := "EMA", ma_3_type_preset := "EMA", ma_4_type_preset := "EMA", ma_5_type_preset := "EMA"

ma_1_lgth = custom_ma_swtch ? ma_1_lgth_custom : ma_1_lgth_preset
ma_2_lgth = custom_ma_swtch ? ma_2_lgth_custom : ma_2_lgth_preset
ma_3_lgth = custom_ma_swtch ? ma_3_lgth_custom : ma_3_lgth_preset
ma_4_lgth = custom_ma_swtch ? ma_4_lgth_custom : ma_4_lgth_preset
ma_5_lgth = custom_ma_swtch ? ma_5_lgth_custom : ma_5_lgth_preset

ma_1_type = custom_ma_swtch ? ma_1_type_custom : ma_1_type_preset
ma_2_type = custom_ma_swtch ? ma_2_type_custom : ma_2_type_preset
ma_3_type = custom_ma_swtch ? ma_3_type_custom : ma_3_type_preset
ma_4_type = custom_ma_swtch ? ma_4_type_custom : ma_4_type_preset
ma_5_type = custom_ma_swtch ? ma_5_type_custom : ma_5_type_preset

ma_1 = cf_ma(src, ma_1_type, ma_1_lgth)
ma_2 = cf_ma(src, ma_2_type, ma_2_lgth)
ma_3 = cf_ma(src, ma_3_type, ma_3_lgth)
ma_4 = cf_ma(src, ma_4_type, ma_4_lgth)
ma_5 = cf_ma(src, ma_5_type, ma_5_lgth)

// ATR Calculations
atr_short_lgth  = math.round(((ma_1_lgth + ma_2_lgth) / 2) * 4.5)
atr_med_lgth    = math.round(((ma_2_lgth + ma_3_lgth) / 2) * 4.0)
atr_long_lgth   = math.round(((ma_4_lgth + ma_5_lgth) / 2) * 1.4)

atr_short_chart = cf_atr_perct(atr_short_lgth)
atr_med_chart   = cf_atr_perct(atr_med_lgth)
atr_long_chart  = cf_atr_perct(atr_long_lgth)

[atr_short_custom, atr_med_custom, atr_long_custom] = request.security(src_symbol_custom, src_tframe, [cf_atr_perct(atr_short_lgth), cf_atr_perct(atr_med_lgth), cf_atr_perct(atr_long_lgth)])
atr_short   = src_symbol_swtch ? atr_short_custom : atr_short_chart
atr_med     = src_symbol_swtch ? atr_med_custom : atr_med_chart
atr_long    = src_symbol_swtch ? atr_long_custom : atr_long_chart

atr_hilo_prct   = math.abs(src_hi - src_lo) / src_lo * 100
atr_short_own   = ta.sma(atr_hilo_prct, atr_short_lgth)
atr_med_own     = ta.sma(atr_hilo_prct, atr_med_lgth)
atr_long_own    = ta.sma(atr_hilo_prct, atr_long_lgth)

atr_short_avg   = ta.wma(((atr_short + atr_short_own)   / 2), math.round(atr_short_lgth * 0.6))
atr_med_avg     = ta.wma(((atr_med + atr_med_own)       / 2), math.round(atr_med_lgth * 0.5))
atr_long_avg    = ta.wma(((atr_long + atr_long_own)     / 2), math.round(atr_long_lgth * 0.2))

atr_short_avg_dist  = ta.wma(atr_short_avg, math.round(atr_short_lgth * 8.0))
atr_med_avg_dist    = ta.wma(atr_med_avg,   math.round(atr_med_lgth * 3.5))
atr_long_avg_dist   = ta.wma(atr_long_avg,  math.round(atr_long_lgth * 1.0))

atr_short_dist  = ta.wma(((math.abs((ma_2 - ma_1) / ma_1) * 30 / atr_short_avg_dist) * 2 + 1),  math.round(atr_short_lgth * 1.5))
atr_med_dist    = ta.wma(((math.abs((ma_3 - ma_2) / ma_2) * 30 / atr_med_avg_dist) * 0.85 + 1),    math.round(atr_med_lgth * 1.2))
atr_long_dist   = ta.wma(((math.abs((ma_5 - ma_4) / ma_4) * 30 / atr_long_avg_dist) * 0.3 + 1),   math.round(atr_long_lgth * 1.0))

atr_short_adj   = atr_short_avg / (atr_distadj_swtch ? atr_short_dist : 1)
atr_med_adj     = atr_med_avg   / (atr_distadj_swtch ? atr_med_dist : 1)
atr_long_adj    = atr_long_avg  / (atr_distadj_swtch ? atr_long_dist : 1)

// MA Slopes
ma_1_slope = cf_slope(ma_1, ma1_slope_smooth)
ma_2_slope = cf_slope(ma_2, ma2_slope_smooth)
ma_3_slope = cf_slope(ma_3, ma3_slope_smooth)
ma_4_slope = cf_slope(ma_4, ma4_slope_smooth)
ma_5_slope = cf_slope(ma_5, ma5_slope_smooth)

ma_slope_comp_pre   = (ma1_swtch ? (ma_1_slope/ma1_factor) : 0) + (ma2_swtch ? (ma_2_slope/ma2_factor) : 0) + (ma3_swtch ? (ma_3_slope/ma3_factor) : 0) + (ma4_swtch ? (ma_4_slope/ma4_factor) : 0) + (ma5_swtch ? (ma_5_slope/ma5_factor) : 0)
ma_slope_comp       = ma_slope_comp_type ==  "SMA" ? ta.sma(ma_slope_comp_pre, ma_slope_comp_smooth) : ta.ema(ma_slope_comp_pre, ma_slope_comp_smooth)

// MA Slope Derivative
ma_1_slope_deriv = ta.sma(ma_1_slope - ma_1_slope[1], ma_slope_deriv_smooth)
ma_2_slope_deriv = ta.sma(ma_2_slope - ma_2_slope[1], ma_slope_deriv_smooth)
ma_3_slope_deriv = ta.sma(ma_3_slope - ma_3_slope[1], ma_slope_deriv_smooth)
ma_4_slope_deriv = ta.sma(ma_4_slope - ma_4_slope[1], ma_slope_deriv_smooth)
ma_5_slope_deriv = ta.sma(ma_5_slope - ma_5_slope[1], ma_slope_deriv_smooth)
ma_slope_deriv_comp = (ma_slope_deriv_comp_type == "SMA" ? ta.sma(ma_slope_comp - ma_slope_comp[1], ma_slope_deriv_comp_smooth) : ta.ema(ma_slope_comp - ma_slope_comp[1], ma_slope_deriv_comp_smooth))

// MA Slope Turnover
ma1_slope_tover = ta.sma((ta.cross(ma_1_slope, 0.0) ? 1 : 0), ma1_tover_smooth)
ma2_slope_tover = ta.sma((ta.cross(ma_2_slope, 0.0) ? 1 : 0), ma2_tover_smooth)
ma3_slope_tover = ta.sma((ta.cross(ma_3_slope, 0.0) ? 1 : 0), ma3_tover_smooth)
ma4_slope_tover = ta.sma((ta.cross(ma_4_slope, 0.0) ? 1 : 0), ma4_tover_smooth)
ma5_slope_tover = ta.sma((ta.cross(ma_5_slope, 0.0) ? 1 : 0), ma5_tover_smooth)
ma_tover_comp = (ma1_slope_tover + ma2_slope_tover + ma3_slope_tover + ma4_slope_tover + ma5_slope_tover) / 3

// MA Distance
ma_1_dist = cf_dist(src, ma_1, ma1_dist_smooth)
ma_2_dist = cf_dist(src, ma_2, ma2_dist_smooth)
ma_3_dist = cf_dist(src, ma_3, ma3_dist_smooth)
ma_4_dist = cf_dist(src, ma_4, ma4_dist_smooth)
ma_5_dist = cf_dist(src, ma_5, ma5_dist_smooth)
ma_dist_comp = ((ma1_dist_swtch ? ma_1_dist : 0) + (ma2_dist_swtch ? ma_2_dist : 0) + (ma3_dist_swtch ? ma_3_dist : 0) + (ma4_dist_swtch ? ma_4_dist : 0) + (ma5_dist_swtch ? ma_5_dist : 0)) / 5

// MA Crossings
ma_12_cross_ma = cf_macross(ma_1, ma_2, ma12_cross_excl, ma12_cross_smooth, "SMA")
ma_23_cross_ma = cf_macross(ma_2, ma_3, ma23_cross_excl, ma23_cross_smooth, "SMA")
ma_34_cross_ma = cf_macross(ma_3, ma_4, ma34_cross_excl, ma34_cross_smooth, "SMA")
ma_45_cross_ma = cf_macross(ma_4, ma_5, ma45_cross_excl, ma45_cross_smooth, "SMA")
ma_cross_comp  = ta.sma((ma_12_cross_ma + ma_23_cross_ma + ma_34_cross_ma + ma_45_cross_ma), ma_cross_comp_smooth)

// RSI
rsi      = ta.rsi(src, 14) * rsi_scaling
rsi_ma   = ta.sma(rsi, rsi_ma_length)
rsi_ma_slope = cf_slope(rsi_ma, rsi_ma_smooth) * rsi_ma_slope_scaling * rsi_scaling

// TREND CALCULATION FUNCTIONS
cf_tab_tover (tover_1, tover_2, tover_1_weight, tover_2_weight, scale_pre_limit, transp_pre_limit, limit_upper, limit_lower, scale_post_limit, smooth_lgth) =>
    tover_weighted      = tover_1 * tover_1_weight + tover_2 * tover_2_weight
    limited             = cf_limit  (tover_weighted * scale_pre_limit + transp_pre_limit, limit_upper, limit_lower)
    mirrored            = math.abs  (limited * scale_post_limit - 1)
    smoothed_final      = ta.wma    (mirrored, math.round(smooth_lgth))

cf_tab_cross (ma_crossings, smooth_lgth_pre_limit, smooth_type_pre_limit, transp_pre_limit, scale_pre_limit, limit_upper, limit_lower, scale_post_limit, smooth_final_lgth) =>
    float cross_smooth  = smooth_type_pre_limit == "HMA" ? ta.hma(ma_crossings, math.round(smooth_lgth_pre_limit)) : ta.ema(ma_crossings, math.round(smooth_lgth_pre_limit))
    cross_adj     = (cross_smooth + transp_pre_limit) * scale_pre_limit
    limited       = cf_limit  (cross_adj, limit_upper, limit_lower)
    mirrored      = math.abs  (limited * scale_post_limit - 1)
    final         = ta.sma    (mirrored, smooth_final_lgth)

cf_tab_madist (ma_shrt, ma_lng, scale_pre_limit, atr, transp_pre_limit, limit_upper, limit_lower, scale_post_limit) => 
    ma_dist       = math.abs  ((ma_lng - ma_shrt) / ma_shrt)
    ma_dist_adj   = ma_dist * scale_pre_limit / atr + transp_pre_limit
    limited       = cf_limit  (ma_dist_adj, limit_upper, limit_lower)
    final         = limited * scale_post_limit + 1

tab_trend_short_tover = cf_tab_tover(ma1_slope_tover, ma2_slope_tover, 1, 1, 0.8, -0.1, 1, 0, 0.9,  (ma_1_lgth + ma_2_lgth) / 9)
tab_trend_med_tover   = cf_tab_tover(ma3_slope_tover, ma4_slope_tover, 3, 1, 1.1, -0.40, 1, 0, 1.0, ma_3_lgth / 2)
tab_trend_long_tover  = cf_tab_tover(ma4_slope_tover, ma5_slope_tover, 1, 1, 1.0, -0.05, 1, 0, 1.8, (ma_4_lgth + ma_5_lgth) / 15.4)

tab_trend_short_cross   = cf_tab_cross(ma_12_cross_ma, (atr_short_lgth * 1.0),      "HMA", -0.080, 5, 1, 0, 0.6, 1)
tab_trend_med_cross     = cf_tab_cross(ma_23_cross_ma, (ma_3_lgth * 1.0),           "EMA", -0.042, 40, 1, 0, 0.8, 10)
tab_trend_long_cross    = cf_tab_cross(ma_45_cross_ma, (atr_long_lgth * 1.0),       "EMA", -0.0075, 95, 1, 0, 0.8, 20)

tab_trend_short_madist = cf_tab_madist(ma_1, ma_2, 30, atr_short_adj,   -0.40, 2.0, 0, 0.33) 
tab_trend_med_madist   = cf_tab_madist(ma_2, ma_3, 25, atr_med_adj,     -0.40, 2.0, 0, 0.20)
tab_trend_long_madist  = cf_tab_madist(ma_4, ma_5, 25, atr_long_adj,    -0.35, 1.8, 0, 0.28)

// SHORT TREND
tab_trend_short_pre = ta.wma(((ma_1_slope + ma_2_slope * 2) * 0.66666 / atr_short_adj * input.float(1.1, "Trend Short Scaling", step = 0.1)), 5) * (test_bool_2 ? tab_trend_short_madist : 1)
tab_trend_short = cf_limit(tab_trend_short_pre, 1, -1) * (test_bool_2 ? tab_trend_short_tover : 1) * (test_bool_2 ? tab_trend_short_cross : 1)

// MED TREND
tab_trend_med_pre = ta.wma(((ma_2_slope + ma_3_slope * 2 + ma_4_slope) * 0.5 / atr_med_adj * input.float(1.35, "Trend Med Scaling", step = 0.1)), 5) * (test_bool_1 ? tab_trend_med_madist : 1)
tab_trend_med = cf_limit(tab_trend_med_pre, 1, -1) * (test_bool_1 ? tab_trend_med_tover : 1) * (test_bool_1 ? tab_trend_med_cross : 1)

// LONG TREND
tab_trend_long_pre = ta.wma(((ma_4_slope * 2 + ma_5_slope) * 0.66666 / atr_long_adj * input.float(1.9, "Trend Long Scaling", step = 0.1)), 5) * (test_bool_2 ? tab_trend_long_madist : 1)
if tab_trend_long_pre < 0
    tab_trend_long_pre *= 1.15
tab_trend_long = cf_limit(tab_trend_long_pre, 1, -1) * (test_bool_1 ? tab_trend_long_tover : 1) * (test_bool_1 ? tab_trend_long_cross : 1)

// LOOK --------------------------------------------------------------------------------------------------------------------------------------------------------

plot(ma_1_slope, "MA 1 Slope", color = color.orange, display = ma_slopes_swtch and not ma_slope_comp_swtch and ma1_swtch ? display.all : display.none)
plot(ma_2_slope, "MA 2 Slope", color = color.yellow, display = ma_slopes_swtch and not ma_slope_comp_swtch and ma2_swtch ? display.all : display.none)
plot(ma_3_slope, "MA 3 Slope", color = color.lime, display = ma_slopes_swtch and not ma_slope_comp_swtch and ma3_swtch ? display.all : display.none)
plot(ma_4_slope, "MA 4 Slope", color = color.blue, display = ma_slopes_swtch and not ma_slope_comp_swtch and ma4_swtch ? display.all : display.none)
plot(ma_5_slope, "MA 5 Slope", color = color.purple, display = ma_slopes_swtch and not ma_slope_comp_swtch and ma5_swtch ? display.all : display.none)
plot(ma_slope_comp, "MA Slope Comp", color = ma_slope_comp >= 0 ? color.blue : color.red, style = plot.style_columns, display = ma_slopes_swtch and ma_slope_comp_swtch ? display.all : display.none)

plot(ma_1_slope_deriv * ma_slope_deriv_scaling, "MA 1 Derivative", color = color.rgb(255, 153, 0, 60), style = plot.style_columns, display = ma_deriv_swtch and ma1_swtch and not ma_slope_deriv_comp_swtch ? display.all : display.none)
plot(ma_2_slope_deriv * ma_slope_deriv_scaling, "MA 2 Derivative", color = color.rgb(255, 235, 59, 60), style = plot.style_columns, display = ma_deriv_swtch and ma2_swtch and not ma_slope_deriv_comp_swtch ? display.all : display.none)
plot(ma_3_slope_deriv * ma_slope_deriv_scaling, "MA 3 Derivative", color = color.rgb(0, 230, 119, 60), style = plot.style_columns, display = ma_deriv_swtch and ma3_swtch and not ma_slope_deriv_comp_swtch ? display.all : display.none)
plot(ma_4_slope_deriv * ma_slope_deriv_scaling, "MA 4 Derivative", color = color.rgb(104, 183, 248, 60), style = plot.style_columns, display = ma_deriv_swtch and ma4_swtch  and not ma_slope_deriv_comp_swtch ? display.all : display.none)
plot(ma_5_slope_deriv * ma_slope_deriv_scaling, "MA 5 Derivative", color = color.rgb(161, 71, 177, 60), style = plot.style_columns, display = ma_deriv_swtch and ma5_swtch and not ma_slope_deriv_comp_swtch ? display.all : display.none)
plot(ma_slope_deriv_comp * ma_slope_deriv_comp_scaling, "MA Derivative Comp", color = color.rgb(255, 255, 255, 60), style = plot.style_columns, display = ma_deriv_swtch and ma_slope_deriv_comp_swtch ? display.all : display.none)

plot(ma1_slope_tover * ma_tover_scaling, "MA 1 Turnover", color = color.rgb(255, 153, 0, 10), style = ma_tover_plot_type == "Histo" ? plot.style_histogram : plot.style_line, display = ma1_tover_swtch and ma_turnover_swtch and not ma_tover_comp_swtch ? display.all : display.none)
plot(ma2_slope_tover * ma_tover_scaling, "MA 2 Turnover", color = color.rgb(255, 235, 59, 10), style = ma_tover_plot_type == "Histo" ? plot.style_histogram : plot.style_line, display = ma2_tover_swtch and ma_turnover_swtch and not ma_tover_comp_swtch ? display.all : display.none)
plot(ma3_slope_tover * ma_tover_scaling, "MA 3 Turnover", color = color.rgb(0, 230, 119, 10), style = ma_tover_plot_type == "Histo" ? plot.style_histogram : plot.style_line, display = ma3_tover_swtch and ma_turnover_swtch and not ma_tover_comp_swtch ? display.all : display.none)
plot(ma4_slope_tover * ma_tover_scaling, "MA 4 Turnover", color = color.rgb(104, 183, 248, 10), style = ma_tover_plot_type == "Histo" ? plot.style_histogram : plot.style_line, display = ma4_tover_swtch and ma_turnover_swtch and not ma_tover_comp_swtch ? display.all : display.none)
plot(ma5_slope_tover * ma_tover_scaling, "MA 5 Turnover", color = color.rgb(161, 71, 177, 10), style = ma_tover_plot_type == "Histo" ? plot.style_histogram : plot.style_line, display = ma5_tover_swtch and ma_turnover_swtch and not ma_tover_comp_swtch ? display.all : display.none)
plot(ma_tover_comp * ma_tover_scaling, "MA Turnover Comp", color = color.white, style = ma_tover_plot_type == "Histo" ? plot.style_histogram : plot.style_line, display = ma_tover_comp_swtch and ma_turnover_swtch ? display.all : display.none)

plot(ma_1_dist * ma_dist_scaling, "MA 1 Distance", color = color.rgb(255, 153, 0, 10), display = ma1_dist_swtch and ma_dist_swtch and not ma_dist_comp_swtch ? display.all : display.none)
plot(ma_2_dist * ma_dist_scaling, "MA 2 Distance", color = color.rgb(255, 235, 59, 10), display = ma2_dist_swtch and ma_dist_swtch and not ma_dist_comp_swtch ? display.all : display.none)
plot(ma_3_dist * ma_dist_scaling, "MA 3 Distance", color = color.rgb(0, 230, 119, 10), display = ma3_dist_swtch and ma_dist_swtch and not ma_dist_comp_swtch ? display.all : display.none)
plot(ma_4_dist * ma_dist_scaling, "MA 4 Distance", color = color.rgb(104, 183, 248, 10), display = ma4_dist_swtch and ma_dist_swtch and not ma_dist_comp_swtch ? display.all : display.none)
plot(ma_5_dist * ma_dist_scaling, "MA 5 Distance", color = color.rgb(161, 71, 177, 10), display = ma5_dist_swtch and ma_dist_swtch and not ma_dist_comp_swtch ? display.all : display.none)
plot(ma_dist_comp * ma_dist_scaling, "MA Distances Comp", color = color.white, display = ma_dist_comp_swtch and ma_dist_swtch ? display.all : display.none)

plot(ma_12_cross_ma * ma_cross_scaling, color = color.orange, title ="1-2 Cross", display = ma12_cross_swtch and ma_cross_swtch and not ma_cross_comp_swtch ? display.all : display.none)
plot(ma_23_cross_ma * ma_cross_scaling, color = color.yellow, title ="2-3 Cross", display = ma23_cross_swtch and ma_cross_swtch and not ma_cross_comp_swtch ? display.all : display.none)
plot(ma_34_cross_ma * ma_cross_scaling, color = color.lime, title ="3-4 Cross", display = ma34_cross_swtch and ma_cross_swtch and not ma_cross_comp_swtch ? display.all : display.none)
plot(ma_45_cross_ma * ma_cross_scaling, color = color.purple, title ="4-5 Cross", display = ma45_cross_swtch and ma_cross_swtch and not ma_cross_comp_swtch ? display.all : display.none)
plot(ma_cross_comp  * ma_cross_scaling, "MA Crossing Comp", color = color.white, display = ma_cross_comp_swtch and ma_cross_swtch ? display.all : display.none)

plot(rsi - (rsi_center ? (50 * rsi_scaling) : 0), "RSI", color = color.rgb(255, 255, 255, 60), display = rsi_swtch and rsi_plot_swtch ? display.all : display.none)
plot(rsi_ma - (rsi_center ? (50 * rsi_scaling) : 0), "RSI MA", color = color.white, display = rsi_swtch and rsi_ma_swtch ? display.all : display.none)
plot(rsi_ma_slope, "RSI MA Slope", color = color.rgb(255, 235, 59, 40), display = rsi_swtch and rsi_ma_slope_swtch ? display.all : display.none)

plot(atr_short_adj, "ATR Short", color = color.white, display = atr_short_swtch ? display.all : display.none)
plot(atr_med_adj, "ATR Medium", color = color.white, display = atr_med_swtch ? display.all : display.none)
plot(atr_long_adj, "ATR Long", color = color.white, display = atr_long_swtch ? display.all : display.none)

hline(zero_line_swtch ? 0 : na, "Zero Line", color=color.new(#ffffff, 0), linestyle = hline.style_dashed)
guide_max   = hline(1, "Max", color = outputs ? #787B86 : #787b8600)
guide_min   = hline(-1, "Min", color = outputs ? #787B86 : #787b8600)
guide_mid_top       = hline(0.5, "Mid 50%", color = outputs ? #787B86 : #787b8600, linestyle = hline.style_dashed)
guide_mid_bottom    = hline(-0.5, "Mid -50%", color = outputs ? #787B86 : #787b8600, linestyle = hline.style_dashed)
guide_consol_upper  = hline(0.2, "Consol Upper", color = color.rgb(255, 255, 255, 100))
guide_consol_lower  = hline(-0.2, "Consol Lower", color = color.rgb(255, 255, 255, 100))
fill(guide_consol_upper, guide_consol_lower, color = outputs ? color.rgb(205, 121, 219, 88) : color.rgb(205, 121, 219, 100))

plot(tab_trend_short, "Tab Trend Short",    color = (outputs and tab_inv and not (tab_out_1 and tab_short)) ? color.rgb(134, 134, 134, 100) : color.rgb(207, 176, 102),   display = (outputs and tab_short and tab_out_1) or (tab_inv and outputs) ? display.all : display.none)
plot(tab_trend_med, "Tab Trend Medium",     color = (outputs and tab_inv and not (tab_out_1 and tab_med)) ? color.rgb(134, 134, 134, 100) : color.rgb(38, 206, 155),     display = (outputs and tab_med and tab_out_1) or (tab_inv and outputs) ? display.all : display.none)
plot(tab_trend_long, "Tab Trend Long",      color = (outputs and tab_inv and not (tab_out_1 and tab_long)) ? color.rgb(134, 134, 134, 100) : color.rgb(65, 151, 221),     display = (outputs and tab_long and tab_out_1) or (tab_inv and outputs) ? display.all : display.none)




// TABLE IMPLEMENTATION v6 ---

var table trendTable = table.new(position.top_right, 3, 2, bgcolor = color.new(color.black, 20), border_width = 0, border_color = color.gray)

// DYNAMIC SHADING USING TRANSPARENCY
get_dynamic_color(val) =>
    float abs_val = math.abs(val)
    // 100 transparency = invisible, 0 = solid. 
    // We want 0% trend to be very transparent (~80) and 100% trend to be solid (0).
    int trans = math.round(80 - (abs_val * 80))
    
    // If neutral (near 0), return a muted gray. Otherwise, Red/Green.
    color base_color = val > 0.02 ? color.rgb(38, 206, 155) : val < -0.02 ? color.rgb(255, 82, 82) : color.rgb(120, 123, 134)
    color.new(base_color, trans)

// FORMATTING FUNCTION (Arrows + No Decimals)
format_trend_text(val) =>
    string arrow = val > 0.05 ? "▲ " : val < -0.05 ? "▼ " : ""
    arrow + str.tostring(math.abs(math.round(val * 100))) + "%"

// UPDATE TABLE
if barstate.islast and outputs
    // Headers
    table.cell(trendTable, 0, 0, "Fast",   text_color = color.rgb(255, 255, 255, 50), text_size = size.normal, text_font_family = font.family_default, text_halign = text.align_left)
    table.cell(trendTable, 1, 0, "Medium", text_color = color.rgb(255, 255, 255, 50), text_size = size.normal, text_font_family = font.family_default, text_halign = text.align_left)
    table.cell(trendTable, 2, 0, "Slow",   text_color = color.rgb(255, 255, 255, 50), text_size = size.normal, text_font_family = font.family_default, text_halign = text.align_left)

    // Data Cells
    table.cell(trendTable, 0, 1, format_trend_text(tab_trend_short), bgcolor = get_dynamic_color(tab_trend_short), text_color = color.white, text_size = size.normal, text_font_family = font.family_default, text_halign = text.align_center)
    table.cell(trendTable, 1, 1, format_trend_text(tab_trend_med),   bgcolor = get_dynamic_color(tab_trend_med),   text_color = color.white, text_size = size.normal, text_font_family = font.family_default, text_halign = text.align_center)
    table.cell(trendTable, 2, 1, format_trend_text(tab_trend_long),  bgcolor = get_dynamic_color(tab_trend_long),  text_color = color.white, text_size = size.normal, text_font_family = font.family_default, text_halign = text.align_center)
