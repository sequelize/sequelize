###
Chosen source: generate output using 'cake build'
Copyright (c) 2011 by Harvest
###
root = this

class AbstractChosen

  constructor: (@form_field, @options={}) ->
    @is_multiple = @form_field.multiple
    this.set_default_text()
    this.set_default_values()

    this.setup()

    this.set_up_html()
    this.register_observers()

    this.finish_setup()

  set_default_values: ->
    @click_test_action = (evt) => this.test_active_click(evt)
    @activate_action = (evt) => this.activate_field(evt)
    @active_field = false
    @mouse_on_container = false
    @results_showing = false
    @result_highlighted = null
    @result_single_selected = null
    @allow_single_deselect = if @options.allow_single_deselect? and @form_field.options[0]? and @form_field.options[0].text is "" then @options.allow_single_deselect else false
    @disable_search_threshold = @options.disable_search_threshold || 0
    @disable_search = @options.disable_search || false
    @enable_split_word_search = if @options.enable_split_word_search? then @options.enable_split_word_search else true
    @search_contains = @options.search_contains || false
    @choices = 0
    @single_backstroke_delete = @options.single_backstroke_delete || false
    @max_selected_options = @options.max_selected_options || Infinity
    @inherit_select_classes = @options.inherit_select_classes || false

  set_default_text: ->
    if @form_field.getAttribute("data-placeholder")
      @default_text = @form_field.getAttribute("data-placeholder")
    else if @is_multiple
      @default_text = @options.placeholder_text_multiple || @options.placeholder_text || "Select Some Options"
    else
      @default_text = @options.placeholder_text_single || @options.placeholder_text || "Select an Option"

    @results_none_found = @form_field.getAttribute("data-no_results_text") || @options.no_results_text || "No results match"

  mouse_enter: -> @mouse_on_container = true
  mouse_leave: -> @mouse_on_container = false

  input_focus: (evt) ->
    if @is_multiple
      setTimeout (=> this.container_mousedown()), 50 unless @active_field
    else
      @activate_field() unless @active_field
  
  input_blur: (evt) ->
    if not @mouse_on_container
      @active_field = false
      setTimeout (=> this.blur_test()), 100

  result_add_option: (option) ->
    if not option.disabled
      option.dom_id = @container_id + "_o_" + option.array_index

      classes = if option.selected and @is_multiple then [] else ["active-result"]
      classes.push "result-selected" if option.selected
      classes.push "group-option" if option.group_array_index?
      classes.push option.classes if option.classes != ""

      style = if option.style.cssText != "" then " style=\"#{option.style}\"" else ""

      '<li id="' + option.dom_id + '" class="' + classes.join(' ') + '"'+style+'>' + option.html + '</li>'
    else
      ""

  results_update_field: ->
    this.results_reset_cleanup() if not @is_multiple
    this.result_clear_highlight()
    @result_single_selected = null
    this.results_build()

  results_toggle: ->
    if @results_showing
      this.results_hide()
    else
      this.results_show()

  results_search: (evt) ->
    if @results_showing
      this.winnow_results()
    else
      this.results_show()

  keyup_checker: (evt) ->
    stroke = evt.which ? evt.keyCode
    this.search_field_scale()

    switch stroke
      when 8
        if @is_multiple and @backstroke_length < 1 and @choices > 0
          this.keydown_backstroke()
        else if not @pending_backstroke
          this.result_clear_highlight()
          this.results_search()
      when 13
        evt.preventDefault()
        this.result_select(evt) if this.results_showing
      when 27
        this.results_hide() if @results_showing
        return true
      when 9, 38, 40, 16, 91, 17
        # don't do anything on these keys
      else this.results_search()

  generate_field_id: ->
    new_id = this.generate_random_id()
    @form_field.id = new_id
    new_id
  
  generate_random_char: ->
    chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
    rand = Math.floor(Math.random() * chars.length)
    newchar = chars.substring rand, rand+1

root.AbstractChosen = AbstractChosen
