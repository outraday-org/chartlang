//@version=5
indicator("MA Slope Master Strat 2.3 LIVE", shorttitle = "MASM Strat 2.3 LIVE", overlay = false)
// In order to turn strat into indicator 1) remove "strategy" with "indicator" 2) remove strategy() properties 3) Remove strategy entries and eit 4) Remove Profit Label completely > FINISHED

// INPUTS & VARIABLES =================================================================================================================================================================================

// Inputs ----------------------------------------------------------------------------------

menue_group_1 = "Timeframe"
startYear   = input.int (2019, "From Y", group=menue_group_1, inline="1")
startMonth  = input.int (1, "M", group=menue_group_1, inline="1")
startDay    = input.int (1, "D", group=menue_group_1, inline="1", tooltip="Start date for strategy timeframe (year, month, day)")
closeYear   = input.int (2027, "Until Y", group=menue_group_1, inline="2")
closeMonth  = input.int (1, "M", group=menue_group_1, inline="2")
closeDay    = input.int (1, "D", group=menue_group_1, inline="2", tooltip="End date for strategy timeframe (year, month, day)")
trades_long = input.bool(true, "Trade Long", group=menue_group_1, inline="3", tooltip = "Enables long trades")
trades_short= input.bool(true, "Trade Short", group=menue_group_1, inline="3", tooltip = "Enables short trades")
lt_trend   = input (title="Trend Wizard v1.0: Tab Trend Long ", group=menue_group_1, inline ="4", tooltip = "", defval = close)

menue_group_2 = "Long Conditions"
long_entry_cond1_swtch  = input.bool (true, "↑ Entry C1 | MA", group=menue_group_2, inline ="1", tooltip ="Enter when MA Slope exceeds consol_range_adj and rsi_ma_slope positive")
long_entry_cond1_ltadj           = input.bool (true,  "LT adj x", group=menue_group_2, inline ="1", tooltip ="Exit when MA slopes down below consol range value")
long_entry_cond1_ltadj_factor1    = input.float (16,  "⇡", group=menue_group_2, inline ="1", tooltip ="Determines how strong MA_Slope is adjusted for by LT trend.", step = 1)
long_entry_cond1_ltadj_factor2    = input.float (1.4,  "⇣", group=menue_group_2, inline ="1", tooltip ="Determines how strong MA_Slope is adjusted for by LT trend.", step = 0.1)
long_entry_cond2_swtch  = input.bool (true, "↑ Entry C2 | RSI", group=menue_group_2, inline ="3", tooltip ="Enter when RSI MA Slope is positive and RSI MA slope deriviative is above cutoff")
long_entry_cond2_cutoff = input.float (2.5, "-> RSI Deriv Cutoff", group=menue_group_2, inline ="3", tooltip = "RSI MA Slope Deriv cutoff value", step = 0.1)

long_exit_cond1_swtch           = input.bool (true,  "↓ Exit C1 | MA", group=menue_group_2, inline ="4", tooltip ="Exit when MA slopes down below consol range value")
long_exit_cond1_ltadj           = input.bool (true,  "LT adj x", group=menue_group_2, inline ="4", tooltip ="Exit when MA slopes down below consol range value")
long_exit_cond1_ltadj_factor1    = input.float (0.5,  "⇡", group=menue_group_2, inline ="4", tooltip ="Determines how strong MA_Slope is adjusted for by LT trend.", step = 0.1)
long_exit_cond1_ltadj_factor2    = input.float (0.5,  "⇣", group=menue_group_2, inline ="4", tooltip ="Determines how strong MA_Slope is adjusted for by LT trend.", step = 0.1)
long_exit_cond2_swtch   = input.bool (false, "↓ Exit C2 | Earnings", group=menue_group_2, inline ="5", tooltip ="Exit when earnings due on bar (only works for post-market earnings)")
long_exit_cond3_swtch   = input.bool (true,  "↓ Exit C3 | Stoploss", group=menue_group_2, inline ="6", tooltip ="Stoploss when price falls below entry price, after x days")
long_pos_cond3_delay    = input.int  (11,     "-> Delay", group=menue_group_2, inline="6", tooltip ="Stoploss when price falls below entry, after x days ('Delay' value)")
long_pos_cond3_wicks    = input.bool (false, "Save Wicks", group=menue_group_2, inline="6", tooltip = "Prevents SL from triggering whenever candle's wick touch entrie's candle's wicks")
long_exit_cond3_rsi     = input.bool (false,  "RSI", group=menue_group_2, inline ="6", tooltip ="Only activate SL once RSI MA slope is below consol_range_adj, removing situations in which momentum is still strong enough to upside as indicated by rsi sloping upwards")
long_exit_cond4_swtch   = input.bool  (false,  "↓ Exit C4 | MA Slope Deriv", group=menue_group_2, inline ="7", tooltip="Exit when MA Slope derivative falls below valu / \nOnly activates when MA slopes down")
ma_deriv_cutoff         = input.float (-0.4,  "-> MA Deriv Cutoff", group=menue_group_2, inline ="7", tooltip = "Determines how fast MA slope has to change to downside to trigger C4 exit (slowing momentum)", step = 0.1)
long_exit_cond5_swtch   = input.bool  (false,  "↓ Exit C5 | RSI", group=menue_group_2, inline ="8", tooltip = "Exit when RSI MA Slope falls below cutoff level, indicating big momentum to the downside")
long_exit_cond5_cutoff  = input.float (-1.5,  "-> RSI Cutoff", group=menue_group_2, inline ="8", tooltip = "RSI MA Slope cutoff / When value falls below, then immediate exit", step = 0.1)

stay_long_cond1_swtch   = input.bool  (false, "Stay Long C1: 8 > 21 DEMA", group=menue_group_2, inline ="8.5", tooltip="Stay Long as long as 8 DEMA is above 21 DEMA")
stay_long_cond2_swtch   = input.bool  (false, "Stay Long C2: Long Trend >", group=menue_group_2, inline ="8.6", tooltip="Stay Long as long as Trend Wizard Long Trend is above 0.6, meaning steady and strong uptrend")
stay_long_cond2_trend_factor = input.float (1.0,  "Trend x", group=menue_group_2, inline ="8.6", tooltip = "", step = 0.05)


never_long_cond1_swtch  = input.bool  (false, "✗ Never Long C1 | 30 WSMA Slope", group=menue_group_2, inline ="9", tooltip="")
never_long_cond1_nogo   = input.float (-0.8, " -> No Go Zone", group=menue_group_2, inline="10", tooltip ="Never Long when 30 WSMA slope below this value", minval=-10, maxval=0, step = 0.1)
never_long_cond1_cutoff = input.float (-0.5, "Slope cutoff: ", group=menue_group_2, inline="10", tooltip ="Slope Cutoff: Never long when 30 WSMA slope below cutoff AND below 50 DSMA / \nNo Go Zone: Never long when 30 WSMA below, even when above 50 DSMA", minval=-10, maxval=0, step = 0.1)
never_long_cond2_swtch  = input.bool  (false, "✗ Never Long C2 | Vola", group=menue_group_2, inline ="11", tooltip="Never Long when bar volaility higher than ATR Factor, instead wait for confirmation")
never_long_cond2_factor = input.float (1.16, " >= ATR x", group=menue_group_2, inline="11", tooltip ="Factor multiplier for ATR value / \nE.g. a factor of 2 would mean never long when price movement is twice as volatile as ATR", minval = 0.1, maxval = 5, step = 0.01)

menue_group_3 = "Short Conditions"
short_exit_cond1_swtch  = input.bool (false,  "↓ Exit C1 | SL", group=menue_group_3, inline ="1", tooltip ="Stoploss when price closes above entry price, after x days & when above MA")
short_exit_cond1_delay  = input.int  (2, "-> Delay", group=menue_group_3, inline="1", tooltip ="Stoploss when price closes above entry_price, after x days ('Delay' value)")
short_exit_cond2_swtch  = input.bool (false,  "↓ Exit C2 | 50 SMA", group=menue_group_3, inline ="2", tooltip ="Exit short when close above 50 SMA after x bars")
short_exit_cond3_swtch  = input.bool (false, "↓ Exit C3 | MA", group=menue_group_3, inline ="3", tooltip ="Exit short when close above MA, after SL delay bars")
stay_short_cond1_swtch  = input.bool (false, "= Stay Short C1 | MA Slope", group=menue_group_3, inline ="4", tooltip ="Stay Short as long as MA Slope is negative")
stay_short_cond2_swtch  = input.bool (false, "= Stay Short C2 | 30 WSMA", group=menue_group_3, inline ="5", tooltip ="Stay Short until long entry signal as long as close below 30 WSMA")

menue_group_4 = "Elements"
ma_deriv_swtch      = input.bool  (false, "MA Slope Derivative", group=menue_group_4, inline = "1", tooltip ="Display MA derivative")
rsi_slope_swtch     = input.bool  (false, "RSI Slope", group=menue_group_4, inline = "2", tooltip ="Display RSI Slope")
rsi_deriv_swtch     = input.bool  (false, "RSI Deriv", group=menue_group_4, inline = "2", tooltip ="Display RSI Slope Derivative")
consol_range_swtch  = input.bool  (false, "Consol Range", group=menue_group_4, inline = "3", tooltip ="Display ATR adjusted Consol Range")
consol_range_lt     = input.bool  (false, "Consol Range LT adj.", group=menue_group_4, inline = "3", tooltip ="Display LT adjusted Consol range")
atr_swtch           = input.bool  (false, "ATR", group=menue_group_4, inline = "4", tooltip ="Display ATR")
atr_length          = input.int   (100, "-> Length", group=menue_group_4, inline = "4", tooltip ="ATR Length timeframe")
atr_smoothing       = input.int   (50, "Smooth", group=menue_group_4, inline = "4", tooltip ="Change smoothing amount for ATR")
ma_w30_slope_swtch  = input.bool  (false, "30 WSMA Slope", group=menue_group_4, inline = "5", tooltip ="Display 30 WSMA slope")
guideline_swtch     = input.bool  (false, "Guidelines", group=menue_group_4, inline="6", tooltip = "Set Guideline range")
guideline_range     = input.float (2.0, "-> Range", group=menue_group_4, inline="6", tooltip = "Display Guidelines", step = 0.1)
trade_signals_swtch = input.bool  (false, "Trade Signals", group=menue_group_4, inline= "7", tooltip = "View Trading Signals 1-4 for export")

menue_group_5 = "Comparison Mode"
compmode_swtch              = input.bool  (false, "Comparison Mode", group=menue_group_5, inline= "8", tooltip = "Compares strategy's performance against simply holding security.")
hide_labels                 = input.bool  (true, "Hide Labels", group=menue_group_5, inline = "8", tooltip = "Hides trade profit labels")
compmode_strat_profit_swtch = input.bool (false, "Strat %", group=menue_group_5, inline= "9", tooltip = "Display Strat Profit in %")
compmode_abs                = input.bool (false, "Strat abs", group=menue_group_5, inline= "9", tooltip = "Displays the strategy's P/L in absolute terms rather than percentage based.")
compmode_hold_profit_swtch  = input.bool (false, "Buy&Hold %", group=menue_group_5, inline= "9", tooltip = "Buy and hold security, profit in %")
compmode_display_swtch      = input.bool (false, "Comp Security %", group=menue_group_5, inline= "10", tooltip = "")
compmode_select             = input.string("Chart", "", options = ["Chart", "NASDAQ:QQQ", "NASDAQ:TQQQ", "AMEX:SPY", "AMEX:IWM", "NASDAQ:SMH", "COINBASE:BTCUSD", "XETR:DAX", "AMEX:URTH", "NASDAQ:EEMA"], group= menue_group_5, inline = "10", tooltip = "Select external ticker to be compared")
compmode_rel_perf_swtch     = input.bool (true, "Strat / Comp", group=menue_group_5, inline= "11", tooltip = "Relative performance of Strat compared to comp symbol")
compmode_rel_perf_lgth      = input.int  (21, "-> MA Length", group=menue_group_5, inline= "11", tooltip = "MA Length for Strat/comp relative performance" )

menue_group_6 = "Moving Average"
ma_length               = input.int (21, "", options=[8,21,30,50,100,200], group=menue_group_6, inline= "1")
ma_type                 = input.string ("EMA", "", options=["SMA", "EMA"], group=menue_group_6, inline= "1")
ma_smoothing            = input.int (3, "Smooth", minval=1, group=menue_group_6, inline="1", tooltip ="Smoothing amount applied to MA")
ma_deriv_smoothing      = input.int (6, "Derivative Smooth", minval=1, group=menue_group_6, inline="2", tooltip ="Smoothing amount applied to MA derivative")
consol_range            = input.float (1.0, "Consol Range", group=menue_group_6, inline="3", tooltip="Range in which MA Slope values are considered consolidation", step = 0.1)
consol_tolerance        = input.int   (4, "Tolerance", group=menue_group_6, inline="3", tooltip="Bars until consecutive MA Slope values within range are considered consolidation")

menue_group_7 = "Other"
close_trades_lastbar    = input.bool (false, "Exit on Last Bar", group=menue_group_7, inline="1", tooltip ="Closes all trades on last historical bar for reviewing strat profits")
market_full_week_swtch  = input.bool (false, "7 Days Market", group=menue_group_7, inline="2", tooltip ="Necessary to calculate 30 WSMA for securities like crypto that trade 7D instead of 5D")


// Variables ----------------------------------------------------------------------------------
var start_price             = 0.0   // Records price at beginning of timeframe
var start_price_close       = 0.0   // Records price at beginning of timeframe
var end_price               = 0.0   // Records price at end of timeframe

var long_pos_active         = false // Tracks whether long pos active
var long_pos_dur            = 0     // Tracks duration of long position in bars
var long_entry_price        = 0.0   // Records entry price for every entered long position
var long_entry_price_low    = 0.0   // Records long entry low at start (low)
var long_pos_profit         = 0.0   // Profit of long trade in percentage
var long_pos_profit_string  = "0"   // Profit of long trade as a string so it can be used as text output

var short_pos_active        = false 
var short_pos_dur           = 0 
var short_entry_price       = 0.0
var short_pos_profit        = 0.0
var short_pos_profit_string = "0"


var color long_pos_exit_clr         = na
var color long_pos_exit_clr_line    = na
long_pos_exit_color_label           = color.rgb(54, 58, 69, 40)
var string long_exit_label_suffix   = "-"
var string long_exit_label_tooltip  = ""
pos_exit_label_position             = long_pos_dur / 2 // Calculates value to put trade description label in center of trade

var color short_pos_exit_clr         = na
var color short_pos_exit_clr_line    = na
short_pos_exit_color_label           = color.rgb(54, 58, 69, 40)
var string short_exit_label_suffix   = "-"
var string short_exit_label_tooltip  = ""
short_pos_exit_label_position        = short_pos_dur / 2 // Calculates value to put trade description label in center of trade

var float   never_long_cond2_close      = 0 // Records close of volatile bar
var float   never_long_cond2_close_prev = 0 // Records close of bar before volatile bar
var int     never_long_cond2_count      = 0 // Is counting the bars after volatile bar occurs

var int short_pos_count = 0 // Counts how long short pos active

var earnings_due = false
var lasttrade_profit = 0.0

int trade_signals_long = na
int trade_signals_short = na

var float compmode_strat_profit = na
var float compmode_hold_profit  = na
var float compmode_sec_profit   = na

var int timeframe_end_counter   = 0

//Compmode Variables
var int start_counter           = 0 
var float comp_sec_start        = na
var float compmode_rel_perf     = na
var float compmode_rel_perf_ma  = na
var float compmode_strat_abs    = na
var float compmode_init_ratio = na

trend_factor_slope = ta.ema((lt_trend - lt_trend[1])*10, 5)


// CALCULATION ================================================================================================================================================================================================

// ATR
atr_short       = ta.atr(14) // Short ATR Length for Never Long C2: Volatility
atr_short_prct  = (atr_short / close) * 100
atr             = ta.atr(atr_length) // ATR in absolute price, NOT %
atr_prct        = ta.sma((atr / close) * 100, atr_smoothing) // Describes how many % on avg security moves within 14 days

// MA
ma          = ma_type == "SMA" ? ta.sma(close, ma_length) : ta.ema(close, ma_length) // Calculate MA
ma_slope    = ta.ema(((ma - ma[1]) / ma[1] * 100), ma_smoothing) // Calculate MA slope as % and apply EMA smmoothing
ma_deriv    = ta.ema(ta.change(ma_slope), ma_deriv_smoothing) / atr_prct * 10 // MA Slope bar to bar difference, adjusted by ATR (same calc as for slope does not work, since values close to and below 0) * 10 for scaling

// Other MA
ma_8        = ta.ema(close, 8)  // 8 EMA
ma_8_slope  = ta.ema(((ma_8 - ma_8[1]) / ma_8[1] * 100), ma_smoothing) // 8 EMA slope in %
ma_50       = ta.sma(close, 50) // 50 SMA
ma_50_slope = ta.ema(((ma_50 - ma_50[1]) / ma_50[1] * 100), ma_smoothing) // 50 SMA slope in %

ma_w30 = not market_full_week_swtch ? ta.sma(close, 145) : ta.sma(close, 210) // 7D Market > 210 for 30 WSMA / 5D Market > 146 (with market holidays)
ma_w30_slope = ta.ema((ma_w30 - ma_w30[1]) / ma_w30[1] * 100, 4) // Calculate Slope of 30 WSMA as a percentage and applying EMA smoothing

// RSI MA
rsi     = ta.rsi(close, 14) // RSI for last 14 bars
rsi_ma  = ta.sma(rsi, 14)   // Calculates 14 SMA of RSI (yellow line in TV RSI)
rsi_ma_slope = ta.ema((rsi_ma - rsi_ma[1]), ma_smoothing) // Calculates difference of RSI SMA to last bar and apply EMA smoothing
rsi_ma_deriv = ta.ema(ta.change(rsi_ma_slope), ma_deriv_smoothing) * 10 // atr_prct * 10

// Earnings Due 
esdSymbolTemplate = "ESD_FACTSET:" + syminfo.prefix + ";" + syminfo.ticker
earnings = request.security(esdSymbolTemplate + ';EARNINGS', 'D', open, lookahead=barmerge.lookahead_on)
earnings_due := earnings != earnings[1] ? true : false // Check whether earnings amount changed to tell whether earnings day or not

// Consolidation Count & Consol Range
consol_range_adj                = (consol_range / 11) * atr_prct // consol range adjusted by atr and divided for scaling

consol_range_adj_lt_top         = lt_trend >= 0 ? (consol_range_adj /  (lt_trend * long_entry_cond1_ltadj_factor1 + 1)) : consol_range_adj * -(lt_trend * long_entry_cond1_ltadj_factor2 - 1) // Adjusts consol_range for LT trend
consol_range_adj_merged_top     = long_entry_cond1_ltadj ? consol_range_adj_lt_top : consol_range_adj

consol_range_adj_lt_bottom      = lt_trend >= 0 ? -consol_range_adj - (lt_trend * long_exit_cond1_ltadj_factor1) : (-consol_range_adj / -(lt_trend * long_exit_cond1_ltadj_factor2 - 1))   // Adjusts consol_range for LT trend
consol_range_adj_merged_bottom  = long_exit_cond1_ltadj ? consol_range_adj_lt_bottom : -consol_range_adj

consol_range_merged_total = ma_slope >= 0 ? consol_range_adj_merged_top : consol_range_adj_merged_bottom

consol_count = 0 // Counts for how many bars price is within consol range
for i = 0 to consol_tolerance
    if (ma_slope[i] > consol_range_adj) or (ma_slope[i] < -consol_range_adj)
        consol_count := 0
        break
    consol_count += 1

// Long Trade Duration & Long Entry Price
long_pos_dur            := long_pos_active ? long_pos_dur + 1 : 0 // Counts for how many bars long trade active & resets to 0 in case no long pos
long_entry_price        := long_pos_active and long_pos_dur == 0 ? close : long_entry_price // Records Long Entry price
long_entry_price_low    := long_pos_active and long_pos_dur == 0 ? low : long_entry_price_low // Records Long Entry low
long_entry_price        := not long_pos_active ? close : long_entry_price // Update stored price for next bar
long_entry_price_low    := not long_pos_active ? low : long_entry_price_low // Update stored price for next bar
//plot(long_entry_price, "Long Position Active", color.green) // debug

// Short Trade Duration & Short Entry Price
short_pos_dur           := short_pos_active ? short_pos_dur + 1 : 0 // Counts for how many bars long short active & resets to 0 in case no short pos
short_entry_price   := short_pos_active and short_pos_dur == 0 ? close : short_entry_price // Records Short Entry price
short_entry_price   := not short_pos_active ? close : short_entry_price // Update stored price for next bar
//plot(short_entry_price, "Long Position Active", color.green) // debug

// Start Price & End Price
if time >= timestamp(startYear, startMonth, startDay, 0, 0) and time[1] < timestamp(startYear, startMonth, startDay, 0, 0) // Finds first bar after timestamp
    line.new(bar_index, 0, bar_index, 0.1, extend = extend.both, color = color.blue, style = line.style_solid, width = 2) // Vertical line indicating beginning of timeframe
    start_price := open // Records open 
    start_price_close := close // Records first close
if time >= timestamp(closeYear, closeMonth, closeDay, 0, 0) and time[1] < timestamp(closeYear, closeMonth, closeDay, 0, 0) // Finds bar after timeframe ends
    line.new(bar_index - 1, 0, bar_index - 1, 0.1, extend = extend.both, color = color.blue, style = line.style_solid, width = 2) // Vertical line indicating end of timeframe
    end_price := close[1] // Records close of last bar in timeframe
//plot(start_price) // debug
//plot(end_price) // debug

in_timeframe    = time >= timestamp(startYear, startMonth, startDay, 0, 0) and time < timestamp(closeYear, closeMonth, closeDay, 0, 0)  // Returns true when within selected timeframe
after_timeframe = time > timestamp(closeYear, closeMonth, closeDay, 0, 0) // Returns true when timeframe has ended

// Bar Change %
change_prct = (close - close[1]) / close[1] * 100

// Comparison Mode [Checked thoroughly, all working!]
comp_sec_close_slct = request.security(compmode_select, "D", close, ignore_invalid_symbol = true)   // Fetches Data for when specific symbol is seledcted
comp_sec_close      = compmode_select == "Chart" ? close : comp_sec_close_slct                      // Uses chart data when "Chart" is selected
comp_sec_open_slct  = request.security(compmode_select, "D", open, ignore_invalid_symbol = true)
comp_sec_open       = compmode_select == "Chart" ? open : comp_sec_open_slct

if in_timeframe and start_counter == 0 and compmode_swtch // Initializes and saves close of first bar within timeframe (close cause that's the earliet any trade could be enetered)
    comp_sec_start  := comp_sec_close
    start_counter   += 1
    compmode_init_ratio := close / comp_sec_close // determines ratio factor at starting point in order to center everything at at 0


if not in_timeframe and compmode_swtch  // Resets values after timeframe ends
    compmode_strat_profit := na
    compmode_hold_profit  := na
    compmode_sec_profit   := na

compmode_rel_perf_rounded   = (math.ceil (compmode_rel_perf * 10) / 10) // Rounding
compmode_rel_perf_ma        := ta.ema(compmode_rel_perf_rounded, compmode_rel_perf_lgth)          // MA for determining plot color



// CONDITIONS ================================================================================================================================================================================================

// LONG CONDITIONS ===========================================================================================================================================================================================

// Never Long Conditions --------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Never Long C1: Placeholder, not active
//never_long_cond1 = (ma_w30_slope < never_long_cond1_nogo ? true : (ma_w30_slope < never_long_cond1_cutoff and close < ma_50)) and never_long_cond1_swtch
never_long_cond1 = false
   and never_long_cond1_swtch
//plot(never_long_cond1_nogo_adj, color = color.orange)
//plot(ma_w30_slope, color = color.white)


// Never Long C2: Volatility
never_long_cond2_pretrig    = change_prct > (atr_short_prct * never_long_cond2_factor) and never_long_cond2_swtch // Triggers when bar change exceeds atr * factor (volatile bars)
never_long_cond2_trig       = never_long_cond2_pretrig 
   and not (never_long_cond2_pretrig[1] and change_prct <= change_prct[1]) // Don't RE-trigger if last bar was volatile & current bar change is lower than volatile bar before
   and not (never_long_cond2_pretrig[2] and change_prct <= change_prct[2]) // Don't RE-trigger if last-last bar was volatile & current bar change is lower than volatile bar before

if never_long_cond2_trig // When triggered (by volatile bar), record close & close_prev + set count to 1 (initiating the next if statement)
    never_long_cond2_close      := close
    never_long_cond2_close_prev := close[1]
    never_long_cond2_count      := 1

if never_long_cond2_count >= 1 and not never_long_cond2_trig // identifies 2nd bar after trigger and does nothing apart from keep counting (This is where you would insert a longer period in which the cond2 just waits before 'releasing')
    never_long_cond2_count := never_long_cond2_count + 1 // Keeps counting to 3rd bar 

if never_long_cond2_count >= 3 and (close > never_long_cond2_close or close < ma or close < never_long_cond2_close_prev) // Identifies 3rd bar and checks for ending conditions of nl_cond2: Either a close above the volatile bar close or a close below ma or a close below the candle before the volatile bar (meaning price returned to point before volatile jump)
    never_long_cond2_count := 0 // Reset to 0 and disable cond2 until new trigger occurs

never_long_cond2 = never_long_cond2_count >= 1 // Set never_long_cond2 based on count
//plot(never_long_cond2_count, color = color.red, linewidth = 2) // debug to check count


never_long_conditions = never_long_cond1 or never_long_cond2 // Combines never long conditions


// Long Entry Conditions --------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Long Entry C1: MA & RSI Slope
long_entry_cond1 = ma_slope > consol_range_adj_merged_top and rsi_ma_slope > 0
   and not long_pos_active and not never_long_conditions and in_timeframe and long_entry_cond1_swtch

long_entry_cond1_dummy = ma_slope > consol_range_adj and rsi_ma_slope > 0 // Marks events when entries got cancelled by never long conditions
   and not long_pos_active and in_timeframe and long_entry_cond1_swtch

// Long Entry C2 RSI
long_entry_cond2 = rsi_ma_deriv >= long_entry_cond2_cutoff and (rsi_ma_slope > 0 or ma_slope > 0) // deriv flashing signal while rsi slope or ma_slope strong enough to support
   and not (ma_slope < - consol_range_adj) // ma_slope not below consol_range to prevent false entries after crashes
   and (ma_slope < 0 ? rsi_ma_slope >= 0.3 : true) // When MA Slope still negative, rsi_ma_slope needs to be higher
   and not (rsi_ma_deriv[1] >= long_entry_cond2_cutoff and rsi_ma_deriv[2] >= long_entry_cond2_cutoff and rsi_ma_deriv[3] >= long_entry_cond2_cutoff) // Only use fresh deriv signals, otherwise often false
   and not long_pos_active and not never_long_conditions and in_timeframe and long_entry_cond2_swtch 

long_entry_conditions = long_entry_cond1 or long_entry_cond2        // Combines all Long Entry Conditions
long_pos_active := long_entry_conditions ? true : long_pos_active   // Sets pos active tracker to true once long entry is triggereds



// Stay Long C1: MA 8 > MA 21
stay_long_cond1 = stay_long_cond1_swtch and (ma_8 >= ma)

// Stay Long C2: Long Trend Wizard > 0.6
stay_long_cond2_factor = lt_trend * stay_long_cond2_trend_factor + ma_slope
//plot(stay_long_cond2_factor, color = color.yellow)
stay_long_cond2 = stay_long_cond2_swtch and (stay_long_cond2_factor >= 0)


stay_long_conditions = stay_long_cond1 or stay_long_cond2 // Collects all Stay Long conditions




// Long Exit Conditions -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Long Exit C1: MA slope
long_exit_cond1 = ma_slope < consol_range_adj_merged_bottom // Closes long pos when MA slope falls below consol_range_adj (MA curling downwards)
   and long_pos_active and not stay_long_conditions and long_exit_cond1_swtch         

// Long Exit C2: Earnings
long_exit_cond2 = earnings_due // Closes long pos when earnings are due next bar
   and long_pos_active and long_exit_cond2_swtch    

// Long Exit C3: SL
long_exit_cond3 = close < long_entry_price and long_pos_dur > long_pos_cond3_delay // Closes long pos when price closes below entry, but only x bars after entry and only when rsi MA doesn't slope up strongly
   and (long_exit_cond3_rsi ? ((rsi_ma_slope < consol_range_adj) or (ma_50_slope <= 0 and close <= ma_50)) : true) and not (close >= ma_8)
   and long_pos_active and not stay_long_conditions and long_exit_cond3_swtch
   and not (long_pos_cond3_wicks and high >= long_entry_price_low and (long_pos_dur < 20) and (trend_factor_slope >= 0)) // Prevents close as long as candle touches entry candle
   //and not (close >= ma_w30 and ma_w30_slope >= 0 and long_exit_cond3_swtch2) (Unused cause not effective, deactivated condition once above ma_w30 sloping up)

// Long Exit C4: Deriv
long_exit_cond4 = ma_deriv < ma_deriv_cutoff and ma_slope < 0 // Closes long pos when MA deriv falls below cutoff (quickly slowing momentum) and MA slopes down
   and long_pos_active and not stay_long_conditions and long_exit_cond4_swtch

// Long Exit C5: RSI
long_exit_cond5 = rsi_ma_slope <= long_exit_cond5_cutoff
   and long_pos_active and not stay_long_conditions and long_exit_cond5_swtch           

long_exit_conditions = long_exit_cond1 or long_exit_cond2 or long_exit_cond3 or long_exit_cond4 or long_exit_cond5 // Combines all Long Exit Conditions

// Execute Long Exit
if long_exit_conditions and trades_long
    long_pos_active := false // Resets variable to indicating no active pos, since long pos closed
    long_pos_profit := (close - long_entry_price) / long_entry_price // Calculates profit of closed trade



// SHORT CONDITIONS ===========================================================================================================================================================================================

// Short Entry --------------------------------------------------------------------------------------------------------------------------------------------------------------------------
if long_exit_conditions and trades_short // Entry when long pos exit
    short_pos_active := true

short_pos_count += short_pos_active ? 1 : 0 // Counts how long trade is active in bars after entry

// Stay Short Conditions --------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Stay Short C1: MA Slope negative
stay_short_cond1 = ma_slope <= 0
   and stay_short_cond1_swtch

// Stay Short C2: 30 WSMA
stay_short_cond2 = (close < ma_w30 or close[1] < ma_w30) and ma_w30_slope <= 0
   and stay_short_cond2_swtch

stay_short_conditions = stay_short_cond1 or stay_short_cond2 // Combines all stay short conditions

// Short Exit Conditions -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Short Exit C1: SL
short_exit_cond1 = close >= short_entry_price and short_pos_count >= (short_exit_cond1_delay + 1) and close >= ma // and ma_50_slope <= 0
   and trades_short and short_exit_cond1_swtch and short_pos_active and not long_exit_conditions and not long_entry_conditions
   and not stay_short_conditions

// Short Exit C2: 50 SMA
short_exit_cond2 = close > ma_50 and short_pos_count >= 10 // Exit short pos if close above 50 SMA, 10 bars after entry
   and trades_short and short_exit_cond2_swtch and short_pos_active and not long_exit_conditions and not long_entry_conditions
   and not stay_short_conditions 

// Short Exit C3: MA
short_exit_cond3 = close >= ma and short_pos_count >= (short_exit_cond1_delay + 1) and (close > ma_w30 or close[1] > ma_w30)
   and trades_short and short_exit_cond3_swtch and short_pos_active and not long_exit_conditions and not long_entry_conditions
   and not stay_short_conditions and not short_exit_cond1


short_exit_conditions = (long_entry_conditions and short_pos_active) or short_exit_cond1 or short_exit_cond2 or short_exit_cond3 // Combines all Short Exit Conditions

// Execute Short Exit
if short_exit_conditions 
    short_pos_active := false
    short_pos_profit := ((short_entry_price - close) / short_entry_price)
    short_pos_count := 0

// Close Trade last bar 
if (barstate.islast or barstate.isrealtime) and long_pos_active and close_trades_lastbar
    long_exit_conditions    := true
    long_pos_profit         := (close - long_entry_price) / long_entry_price // Calculates profit of closed trade
    lasttrade_profit        := long_pos_profit
if (barstate.islast or barstate.isrealtime) and short_pos_active and close_trades_lastbar
    short_exit_conditions   := true
    short_pos_profit        := ((short_entry_price - close) / short_entry_price)
    lasttrade_profit        := short_pos_profit




// LOOK =================================================================================================================================================================================================

// Color Palette ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
clr_green   = input.color(color.rgb(13, 218, 116), "Up", inline = "1")
clr_red     = input.color(color.rgb(255, 82, 120), "Down", inline = "1")
clr_purple  = input.color(color.rgb(208, 113, 252), "Consol", inline = "2")
clr_yellow  = input.color(color.yellow, "Yellow", inline = "2")

// BG Color Change
bgcolor = long_pos_active ? color.new(clr_green, 88) : short_pos_active ? color.new(clr_red, 88) : na
bgcolor(bgcolor) // If placed between entry & exit, it will change color one bar later

// MA Slope color
ma_slope_clr  = ma_slope >= 0 ? color.new(clr_green, 0) : color.new(clr_red, 0)
ma_slope_clr  := (ma_slope < consol_range_adj and ma_slope > -consol_range_adj and consol_count > consol_tolerance) ? color.new(clr_purple, 0) : ma_slope_clr
ma_deriv_clr  = ma_deriv < ma_deriv_cutoff ? color.rgb(185, 185, 185, 35) : color.rgb(82, 82, 82, 35)


// Labels ---------------------------------------------------------------------------------------------------------------------------------------------------------------------

// Long Entry Label
if long_entry_cond2 and not long_entry_cond1 and not (hide_labels and compmode_swtch) // Mark Entry Cond 2
    label.new (bar_index, -1.9, text = "↑", style = label.style_none, size = size.small, color = clr_green, textcolor = clr_green, tooltip = "C2: rsi_ma_deriv >= cutoff & rsi_ma_slope > 0")

// Long Exit Label & Line 
if long_exit_conditions
    long_pos_exit_clr         := long_pos_profit >= 0.02 ? clr_green : long_pos_profit < 0.02 and long_pos_profit > -0.02 ? clr_yellow : clr_red // Calculates exit color depending on profit
    long_pos_exit_clr_line    := long_pos_profit >= 0.02 ? color.new(clr_green, 25): long_pos_profit < 0.02 and long_pos_profit > -0.02 ? color.new(clr_yellow, 25) : color.new(clr_red, 25) // Color of Exit Line
    //if not trades_short // Clean up visually if short trades enabled
        //line.new (bar_index, 0, bar_index, 0.1, extend = extend.both, color = long_pos_exit_clr_line, style = line.style_solid) // Draws vertical profit line upon exit

    // Exit Labels
    long_exit_label_suffix := long_exit_cond1 ? " ma"       : long_exit_label_suffix
    long_exit_label_suffix := long_exit_cond2 ? " ea"       : long_exit_label_suffix
    long_exit_label_suffix := long_exit_cond3 ? " sl"       : long_exit_label_suffix
    long_exit_label_suffix := long_exit_cond4 ? " deriv"    : long_exit_label_suffix
    long_exit_label_suffix := long_exit_cond5 ? " rsi"      : long_exit_label_suffix

    long_exit_label_tooltip := long_exit_cond1 ? "moving average sloping down below consol range"       : long_exit_label_tooltip
    long_exit_label_tooltip := long_exit_cond2 ? "earnings due"                                         : long_exit_label_tooltip
    long_exit_label_tooltip := long_exit_cond3 ? "stop loss: close below entry after x trade_duration"  : long_exit_label_tooltip
    long_exit_label_tooltip := long_exit_cond4 ? "derivative of ma slope decreasing at quick rate"      : long_exit_label_tooltip
    long_exit_label_tooltip := long_exit_cond5 ? "RSI MA slope below cutoff"                            : long_exit_label_tooltip
    
    long_pos_profit := (math.ceil(long_pos_profit * 1000) / 1000) * 100 // Rounding Profit to one decimal
    long_exit_cond2_label = str.tostring(long_pos_profit) + long_exit_label_suffix // Label Text
    if trades_long and not (hide_labels and compmode_swtch)
        label.new (bar_index - pos_exit_label_position, -1.6, text = long_exit_cond2_label, style = label.style_none, size = size.small, color = long_pos_exit_color_label, textcolor = long_pos_exit_clr, tooltip = long_exit_label_tooltip)

// Short Exit Label & Line
if short_exit_conditions
    short_pos_exit_clr         := short_pos_profit >= 0.02 ? clr_green : short_pos_profit < 0.02 and short_pos_profit > -0.02 ? clr_yellow : clr_red // Calculates exit color depending on profit
    short_pos_exit_clr_line    := short_pos_profit >= 0.02 ? color.new(clr_green, 25): short_pos_profit < 0.02 and short_pos_profit > -0.02 ? color.new(clr_yellow, 25) : color.new(clr_red, 25) // Color of Exit Line

    // Exit Labels
    short_exit_label_suffix := not short_exit_conditions ? "" : ""
    short_exit_label_suffix := short_exit_cond1 ? " sl"       : short_exit_label_suffix
    short_exit_label_suffix := short_exit_cond2 ? " MA50"     : short_exit_label_suffix
    short_exit_label_suffix := short_exit_cond3 ? " MA"       : short_exit_label_suffix

    short_exit_label_tooltip := short_exit_cond1 ? "close above entry price after x bars + above MA"        : short_exit_label_tooltip
    short_exit_label_tooltip := short_exit_cond2 ? "close above 50 SMA after x bars"                        : short_exit_label_tooltip
    short_exit_label_tooltip := short_exit_cond3 ? "close above ma after x bars + below 30 WSMA"            : short_exit_label_tooltip
    short_exit_label_tooltip := not short_exit_conditions ? "Long Entry as exit signal"                     : short_exit_label_tooltip
    

    short_pos_profit := (math.ceil(short_pos_profit * 1000) / 1000) * 100 // Rounding Profit to one decimal
    short_exit_cond2_label = str.tostring(short_pos_profit) + short_exit_label_suffix // Label Text
    if trades_short and not (hide_labels and compmode_swtch)
        label.new (bar_index - short_pos_exit_label_position, 1.6, text = short_exit_cond2_label, style = label.style_none, size = size.small, color = short_pos_exit_color_label, textcolor = short_pos_exit_clr, tooltip = long_exit_label_tooltip)





// Plots ---------------------------------------------------------------------------------------------------------------------------------------------------------------------
//hline (0, "Zero Line", color = color.new(color.gray, 35), linestyle = hline.style_dashed) //Zero-Line

plot (ma_slope, "MA Slope", style = plot.style_columns, color = ma_slope_clr, display = compmode_swtch ? display.none : display.all) // MA Slope
consolidation_bars = ma_slope < 0 ? (ma_slope > consol_range_merged_total ? ma_slope : consol_range_merged_total) : (ma_slope > consol_range_merged_total ? consol_range_merged_total : ma_slope) // Calculate overlay Consolidation area
plot (consolidation_bars, "Consolidation Overlay Bars", style = plot.style_columns, color = ma_slope < consol_range_adj and ma_slope > -consol_range_adj and consol_count > consol_tolerance ? clr_purple : color.white, display = compmode_swtch ? display.none : display.all)
plot (ma_deriv, "MA Slope derivative", color = ma_deriv_clr, linewidth = 1, style = plot.style_columns, display = ma_deriv_swtch ? display.all : display.none) // Plot derivative of smoothed MA slope

plot (rsi_ma_slope,         "RSI MA Slope", color = rsi_ma_slope <= long_exit_cond5_cutoff ? clr_red : color.white, linewidth = 1, display = rsi_slope_swtch ? display.all : display.none) // Plot Smoothed RSI Slope
plot (rsi_ma_deriv,         "RSI Deriv", color = rsi_ma_deriv >= long_entry_cond2_cutoff ? clr_green : color.rgb(255, 255, 255, 50), display = rsi_deriv_swtch ? display.all : display.none) // RSI Slope Derivative
plot (atr_prct,             "ATR", color = clr_yellow, display = atr_swtch ? display.all : display.none) // Display ATR values in %
plot (consol_range_adj,     "Consol Range Upper Band", color = color.rgb(112, 112, 112), display = consol_range_swtch ? display.all : display.none)  // Consol Range
plot (-consol_range_adj,    "Consol Range Lower Band", color = color.rgb(112, 112, 112), display = consol_range_swtch ? display.all : display.none) // Consol Range mirrored
plot (consol_range_adj_lt_bottom, "Consol Range Top LT adjusted", color = color.red, display = consol_range_lt and not compmode_swtch ? display.all : display.none) // Consol Range adjusted by LT trend
plot (consol_range_adj_lt_top, "Consol Range Bottom LT adjusted", color = color.red, display = consol_range_lt and not compmode_swtch ? display.all : display.none) // Consol Range adjusted by LT trend
plot (ma_w30_slope,         "30 WSMA slope", color = color.white, display = ma_w30_slope_swtch ? display.pane : display.none) // 30 WSMA Slope

// Event: never_long conditions cancel entry
never_long_cond1_cancel = never_long_cond1 and long_entry_cond1_dummy
never_long_cond1_all    = never_long_cond1 and not long_entry_cond1_dummy // Displays all incidents, not just when entry is cancelled
plotshape (never_long_cond1_cancel, "Never Long C1 Cancel", style = shape.xcross, location = location.top, size = size.tiny, color = color.rgb(124, 111, 111), textcolor = color.rgb(124, 111, 111), text = "1", display = display.pane)
plotshape (never_long_cond1_all, "Never Long C1 Cancel", style = shape.xcross, location = location.top, size = size.tiny, color = color.rgb(124, 111, 111, 100), textcolor = color.rgb(124, 111, 111, 60), text = "1", display = display.pane)

never_long_cond2_cancel = never_long_cond2 and long_entry_cond1_dummy
never_long_cond2_all    = never_long_cond2 and not long_entry_cond1_dummy // Displays all incidents, not just when entry is cancelled
plotshape (never_long_cond2_cancel, "Never Long C2 Cancel", style = shape.xcross, location = location.top, size = size.tiny, color = color.rgb(124, 111, 111), textcolor = color.rgb(124, 111, 111), text = "2", display = display.pane)
plotshape (never_long_cond2_all, "Never Long C2 Cancel", style = shape.xcross, location = location.top, size = size.tiny, color = color.rgb(124, 111, 111, 100), textcolor = color.rgb(124, 111, 111, 60), text = "2", display = display.pane)

// Event: stay_long conditions cancel exits
stay_long_conditions_cancel = stay_long_conditions and long_exit_conditions
plotshape (stay_long_conditions_cancel, "Stay Long C Cancel", location = location.top, size = size.tiny, color = color.rgb(124, 111, 111), textcolor = color.rgb(124, 111, 111), text = "sl1", display = display.pane)

// Guidelines
guideline_swtch_cond = guideline_swtch ? guideline_range : na // When Guideline on > Guideline_range / If not then na
plot (guideline_swtch_cond, "Guideline Top", color = #ffffff50, linewidth = 1, style = plot.style_stepline, display = display.pane) //Plot Upper Guideline
plot (-guideline_swtch_cond, "Guideline Bottom", color = #ffffff50, linewidth = 1, style = plot.style_line, display = display.pane) //Plot Lower Guideline

// Trade Signals
plot (trade_signals_long, "Trade Signals Long", color = color.lime, display = trade_signals_swtch ? display.all : display.none, style = plot.style_circles)
plot (trade_signals_short, "Trade Signals Short", color = color.red, display = trade_signals_swtch ? display.all : display.none, style = plot.style_circles)

// Comparison Mode
hline (0, "Compmode Zero Line", color = color.white, linestyle = hline.style_dashed, display = compmode_swtch ? display.all : display.none)
plot(compmode_strat_profit, "Compmode Strat Profit", color = color.white, display = compmode_swtch and compmode_strat_profit_swtch ? display.all : display.none)
plot(compmode_strat_abs, "Compmode Strat Profit Absolute", color = color.rgb(255, 255, 255, 50), display = compmode_swtch and compmode_abs ? display.all : display.none)
plot(compmode_hold_profit, "Compmode Hold Profit", color = color.rgb(255, 255, 255, 50), display = compmode_swtch and compmode_hold_profit_swtch ? display.all : display.none)
plot(compmode_sec_profit, "Compmode request.security Profit", color = color.blue, display = compmode_swtch and compmode_display_swtch ? display.all : display.none)
plot(compmode_rel_perf, "Compmode Strat/Comp_sec", color = (compmode_select == "Chart" and long_pos_active) ? color.yellow : compmode_rel_perf_ma >= compmode_rel_perf_ma[1] ? color.lime : color.red, display = compmode_swtch and compmode_rel_perf_swtch ? display.all : display.none)



// ==========================================
// API ALERTS
// ==========================================

// Checks 4 minutes before close, dynamically retrieves daily candle closing time.
// Keeps checking on every tick until Close.
// Stops checking as soon as first alert sent.

// 1. Time Window for checking
ms_until_close = time_close - timenow // 'time_close' is the timestamp when the CURRENT bar will end. 'timenow' is the current live server time.
ms_trigger_window = 4 * 60 * 1000 // Time Window in milliseconds
is_window = (ms_until_close <= ms_trigger_window) and (ms_until_close > 0) and barstate.isrealtime // Checks whether currently checking window open

// 2. Alerted yet?
varip bool alerted_this_session = false
// Reset alerted to false outside of checking window
if ms_until_close > ms_trigger_window
    alerted_this_session := false

// 3. Triggers

// TRIGGER A: GO LONG (Entry met + Not Long Previously + In Window + Not Alerted)
alert_trigger_go_long       = is_window and long_entry_conditions and not long_pos_active[1] and not alerted_this_session

// TRIGGER B: GO SHORT (Flip) (Exit met + Not Short Previously + In Window + Not Alerted)
alert_trigger_go_short      = is_window and long_exit_conditions and trades_short and not short_pos_active[1] and not alerted_this_session

// TRIGGER C: CLOSE SHORT (Flatten Only) (Short Exit met + We WERE Short + No Flip + In Window + Not Alerted)
alert_trigger_flatten_short = is_window and short_exit_conditions and short_pos_active[1] and not long_entry_conditions and not alerted_this_session

// TRIGGER D: CLOSE LONG (Flatten Only) (Long Exit met + We WERE Long + No Flip + In Window + Not Alerted)
alert_trigger_flatten_long  = is_window and long_exit_conditions and long_pos_active[1] and not trades_short and not alerted_this_session

// 4. Trigger Alert Execution
string alert_msg = na

api_token = input.string("PASTE API KEY HERE", "API KEY", group="Alert Settings")

if alert_trigger_go_long
    alert_msg := '{"symbol": "' + syminfo.ticker + '", "action": "buy",           "apiKey": "' + api_token + '"}'
else if alert_trigger_go_short
    alert_msg := '{"symbol": "' + syminfo.ticker + '", "action": "sell",          "apiKey": "' + api_token + '"}'
else if alert_trigger_flatten_short
    alert_msg := '{"symbol": "' + syminfo.ticker + '", "action": "close_short",   "apiKey": "' + api_token + '"}'
else if alert_trigger_flatten_long
    alert_msg := '{"symbol": "' + syminfo.ticker + '", "action": "close_long",    "apiKey": "' + api_token + '"}'

// 5. Fire the Alert
if not na(alert_msg)
    alert(alert_msg, alert.freq_all)
    alerted_this_session := true
