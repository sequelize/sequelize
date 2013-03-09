###
Chosen source: generate output using 'cake build'
Copyright (c) 2011 by Harvest
###
root = this
$ = jQuery

$.fn.extend({
  chosen: (options) ->
    # Do no harm and return as soon as possible for unsupported browsers, namely IE6 and IE7
    # Continue on if running IE document type but in compatibility mode
    return this if $.browser.msie and ($.browser.version is "6.0" or  ($.browser.version is "7.0" and document.documentMode is 7 ))
    this.each((input_field) ->
      $this = $ this
      $this.data('chosen', new Chosen(this, options)) unless $this.hasClass "chzn-done"
    )
})

class Chosen extends AbstractChosen

  setup: ->
    @form_field_jq = $ @form_field
    @current_value = @form_field_jq.val()
    @is_rtl = @form_field_jq.hasClass "chzn-rtl"

  finish_setup: ->
    @form_field_jq.addClass "chzn-done"

  set_up_html: ->
    @container_id = if @form_field.id.length then @form_field.id.replace(/[^\w]/g, '_') else this.generate_field_id()
    @container_id += "_chzn"

    container_classes = ["chzn-container"]
    container_classes.push "chzn-container-" + (if @is_multiple then "multi" else "single")
    container_classes.push @form_field.className if @inherit_select_classes && @form_field.className
    container_classes.push "chzn-rtl" if @is_rtl

    @f_width = @form_field_jq.outerWidth()

    container_props = 
      id: @container_id
      class: container_classes.join ' '
      style: 'width: ' + (@f_width) + 'px;' #use parens around @f_width so coffeescript doesn't think + ' px' is a function parameter
      title: @form_field.title

    container_div = ($ "<div />", container_props)

    if @is_multiple
      container_div.html '<ul class="chzn-choices"><li class="search-field"><input type="text" value="' + @default_text + '" class="default" autocomplete="off" style="width:25px;" /></li></ul><div class="chzn-drop" style="left:-9000px;"><ul class="chzn-results"></ul></div>'
    else
      container_div.html '<a href="javascript:void(0)" class="chzn-single chzn-default" tabindex="-1"><span>' + @default_text + '</span><div><b></b></div></a><div class="chzn-drop" style="left:-9000px;"><div class="chzn-search"><input type="text" autocomplete="off" /></div><ul class="chzn-results"></ul></div>'

    @form_field_jq.hide().after container_div
    @container = ($ '#' + @container_id)
    @dropdown = @container.find('div.chzn-drop').first()

    dd_top = @container.height()
    dd_width = (@f_width - get_side_border_padding(@dropdown))

    @dropdown.css({"width": dd_width  + "px", "top": dd_top + "px"})

    @search_field = @container.find('input').first()
    @search_results = @container.find('ul.chzn-results').first()
    this.search_field_scale()

    @search_no_results = @container.find('li.no-results').first()

    if @is_multiple
      @search_choices = @container.find('ul.chzn-choices').first()
      @search_container = @container.find('li.search-field').first()
    else
      @search_container = @container.find('div.chzn-search').first()
      @selected_item = @container.find('.chzn-single').first()
      sf_width = dd_width - get_side_border_padding(@search_container) - get_side_border_padding(@search_field)
      @search_field.css( {"width" : sf_width + "px"} )

    this.results_build()
    this.set_tab_index()
    @form_field_jq.trigger("liszt:ready", {chosen: this})

  register_observers: ->
    @container.mousedown (evt) => this.container_mousedown(evt)
    @container.mouseup (evt) => this.container_mouseup(evt)
    @container.mouseenter (evt) => this.mouse_enter(evt)
    @container.mouseleave (evt) => this.mouse_leave(evt)

    @search_results.mouseup (evt) => this.search_results_mouseup(evt)
    @search_results.mouseover (evt) => this.search_results_mouseover(evt)
    @search_results.mouseout (evt) => this.search_results_mouseout(evt)

    @form_field_jq.bind "liszt:updated", (evt) => this.results_update_field(evt)
    @form_field_jq.bind "liszt:activate", (evt) => this.activate_field(evt)
    @form_field_jq.bind "liszt:open", (evt) => this.container_mousedown(evt)

    @search_field.blur (evt) => this.input_blur(evt)
    @search_field.keyup (evt) => this.keyup_checker(evt)
    @search_field.keydown (evt) => this.keydown_checker(evt)
    @search_field.focus (evt) => this.input_focus(evt)

    if @is_multiple
      @search_choices.click (evt) => this.choices_click(evt)
    else
      @container.click (evt) => evt.preventDefault() # gobble click of anchor


  search_field_disabled: ->
    @is_disabled = @form_field_jq[0].disabled
    if(@is_disabled)
      @container.addClass 'chzn-disabled'
      @search_field[0].disabled = true
      @selected_item.unbind "focus", @activate_action if !@is_multiple
      this.close_field()
    else
      @container.removeClass 'chzn-disabled'
      @search_field[0].disabled = false
      @selected_item.bind "focus", @activate_action if !@is_multiple

  container_mousedown: (evt) ->
    if !@is_disabled
      target_closelink =  if evt? then ($ evt.target).hasClass "search-choice-close" else false
      if evt and evt.type is "mousedown" and not @results_showing
        evt.preventDefault()
      if not @pending_destroy_click and not target_closelink
        if not @active_field
          @search_field.val "" if @is_multiple
          $(document).click @click_test_action
          this.results_show()
        else if not @is_multiple and evt and (($(evt.target)[0] == @selected_item[0]) || $(evt.target).parents("a.chzn-single").length)
          evt.preventDefault()
          this.results_toggle()

        this.activate_field()
      else
        @pending_destroy_click = false

  container_mouseup: (evt) ->
    this.results_reset(evt) if evt.target.nodeName is "ABBR" and not @is_disabled

  blur_test: (evt) ->
    this.close_field() if not @active_field and @container.hasClass "chzn-container-active"

  close_field: ->
    $(document).unbind "click", @click_test_action

    @active_field = false
    this.results_hide()

    @container.removeClass "chzn-container-active"
    this.winnow_results_clear()
    this.clear_backstroke()

    this.show_search_field_default()
    this.search_field_scale()

  activate_field: ->
    @container.addClass "chzn-container-active"
    @active_field = true

    @search_field.val(@search_field.val())
    @search_field.focus()


  test_active_click: (evt) ->
    if $(evt.target).parents('#' + @container_id).length
      @active_field = true
    else
      this.close_field()

  results_build: ->
    @parsing = true
    @results_data = root.SelectParser.select_to_array @form_field

    if @is_multiple and @choices > 0
      @search_choices.find("li.search-choice").remove()
      @choices = 0
    else if not @is_multiple
      @selected_item.addClass("chzn-default").find("span").text(@default_text)
      if @disable_search or @form_field.options.length <= @disable_search_threshold
        @container.addClass "chzn-container-single-nosearch"
      else
        @container.removeClass "chzn-container-single-nosearch"

    content = ''
    for data in @results_data
      if data.group
        content += this.result_add_group data
      else if !data.empty
        content += this.result_add_option data
        if data.selected and @is_multiple
          this.choice_build data
        else if data.selected and not @is_multiple
          @selected_item.removeClass("chzn-default").find("span").text data.text
          this.single_deselect_control_build() if @allow_single_deselect

    this.search_field_disabled()
    this.show_search_field_default()
    this.search_field_scale()

    @search_results.html content
    @parsing = false


  result_add_group: (group) ->
    if not group.disabled
      group.dom_id = @container_id + "_g_" + group.array_index
      '<li id="' + group.dom_id + '" class="group-result">' + $("<div />").text(group.label).html() + '</li>'
    else
      ""

  result_do_highlight: (el) ->
    if el.length
      this.result_clear_highlight()

      @result_highlight = el
      @result_highlight.addClass "highlighted"

      maxHeight = parseInt @search_results.css("maxHeight"), 10
      visible_top = @search_results.scrollTop()
      visible_bottom = maxHeight + visible_top

      high_top = @result_highlight.position().top + @search_results.scrollTop()
      high_bottom = high_top + @result_highlight.outerHeight()

      if high_bottom >= visible_bottom
        @search_results.scrollTop if (high_bottom - maxHeight) > 0 then (high_bottom - maxHeight) else 0
      else if high_top < visible_top
        @search_results.scrollTop high_top

  result_clear_highlight: ->
    @result_highlight.removeClass "highlighted" if @result_highlight
    @result_highlight = null

  results_show: ->
    if not @is_multiple
      @selected_item.addClass "chzn-single-with-drop"
      if @result_single_selected
        this.result_do_highlight( @result_single_selected )
    else if @max_selected_options <= @choices
      @form_field_jq.trigger("liszt:maxselected", {chosen: this})
      return false

    dd_top = if @is_multiple then @container.height() else (@container.height() - 1)
    @form_field_jq.trigger("liszt:showing_dropdown", {chosen: this})
    @dropdown.css {"top":  dd_top + "px", "left":0}
    @results_showing = true

    @search_field.focus()
    @search_field.val @search_field.val()

    this.winnow_results()

  results_hide: ->
    @selected_item.removeClass "chzn-single-with-drop" unless @is_multiple
    this.result_clear_highlight()
    @form_field_jq.trigger("liszt:hiding_dropdown", {chosen: this})
    @dropdown.css {"left":"-9000px"}
    @results_showing = false


  set_tab_index: (el) ->
    if @form_field_jq.attr "tabindex"
      ti = @form_field_jq.attr "tabindex"
      @form_field_jq.attr "tabindex", -1
      @search_field.attr "tabindex", ti

  show_search_field_default: ->
    if @is_multiple and @choices < 1 and not @active_field
      @search_field.val(@default_text)
      @search_field.addClass "default"
    else
      @search_field.val("")
      @search_field.removeClass "default"

  search_results_mouseup: (evt) ->
    target = if $(evt.target).hasClass "active-result" then $(evt.target) else $(evt.target).parents(".active-result").first()
    if target.length
      @result_highlight = target
      this.result_select(evt)
      @search_field.focus()

  search_results_mouseover: (evt) ->
    target = if $(evt.target).hasClass "active-result" then $(evt.target) else $(evt.target).parents(".active-result").first()
    this.result_do_highlight( target ) if target

  search_results_mouseout: (evt) ->
    this.result_clear_highlight() if $(evt.target).hasClass "active-result" or $(evt.target).parents('.active-result').first()


  choices_click: (evt) ->
    evt.preventDefault()
    if( @active_field and not($(evt.target).hasClass "search-choice" or $(evt.target).parents('.search-choice').first) and not @results_showing )
      this.results_show()

  choice_build: (item) ->
    if @is_multiple and @max_selected_options <= @choices
      @form_field_jq.trigger("liszt:maxselected", {chosen: this})
      return false # fire event
    choice_id = @container_id + "_c_" + item.array_index
    @choices += 1
    if item.disabled
      html = '<li class="search-choice search-choice-disabled" id="' + choice_id + '"><span>' + item.html + '</span></li>'
    else
      html = '<li class="search-choice" id="' + choice_id + '"><span>' + item.html + '</span><a href="javascript:void(0)" class="search-choice-close" rel="' + item.array_index + '"></a></li>'
    @search_container.before  html
    link = $('#' + choice_id).find("a").first()
    link.click (evt) => this.choice_destroy_link_click(evt)

  choice_destroy_link_click: (evt) ->
    evt.preventDefault()
    if not @is_disabled
      @pending_destroy_click = true
      this.choice_destroy $(evt.target)
    else
      evt.stopPropagation

  choice_destroy: (link) ->
    if this.result_deselect (link.attr "rel")
      @choices -= 1
      this.show_search_field_default()

      this.results_hide() if @is_multiple and @choices > 0 and @search_field.val().length < 1

      link.parents('li').first().remove()

      this.search_field_scale()

  results_reset: ->
    @form_field.options[0].selected = true
    @selected_item.find("span").text @default_text
    @selected_item.addClass("chzn-default") if not @is_multiple
    this.show_search_field_default()
    this.results_reset_cleanup()
    @form_field_jq.trigger "change"
    this.results_hide() if @active_field

  results_reset_cleanup: ->
    @current_value = @form_field_jq.val()
    @selected_item.find("abbr").remove()

  result_select: (evt) ->
    if @result_highlight
      high = @result_highlight
      high_id = high.attr "id"

      this.result_clear_highlight()

      if @is_multiple
        this.result_deactivate high
      else
        @search_results.find(".result-selected").removeClass "result-selected"
        @result_single_selected = high
        @selected_item.removeClass("chzn-default")

      high.addClass "result-selected"

      position = high_id.substr(high_id.lastIndexOf("_") + 1 )
      item = @results_data[position]
      item.selected = true

      @form_field.options[item.options_index].selected = true

      if @is_multiple
        this.choice_build item
      else
        @selected_item.find("span").first().text item.text
        this.single_deselect_control_build() if @allow_single_deselect

      this.results_hide() unless (evt.metaKey or evt.ctrlKey) and @is_multiple

      @search_field.val ""

      @form_field_jq.trigger "change", {'selected': @form_field.options[item.options_index].value} if @is_multiple || @form_field_jq.val() != @current_value
      @current_value = @form_field_jq.val()
      this.search_field_scale()

  result_activate: (el) ->
    el.addClass("active-result")

  result_deactivate: (el) ->
    el.removeClass("active-result")

  result_deselect: (pos) ->
    result_data = @results_data[pos]

    if not @form_field.options[result_data.options_index].disabled
      result_data.selected = false

      @form_field.options[result_data.options_index].selected = false
      result = $("#" + @container_id + "_o_" + pos)
      result.removeClass("result-selected").addClass("active-result").show()

      this.result_clear_highlight()
      this.winnow_results()

      @form_field_jq.trigger "change", {deselected: @form_field.options[result_data.options_index].value}
      this.search_field_scale()

      return true
    else
      return false

  single_deselect_control_build: ->
    @selected_item.find("span").first().after "<abbr class=\"search-choice-close\"></abbr>" if @allow_single_deselect and @selected_item.find("abbr").length < 1

  winnow_results: ->
    this.no_results_clear()

    results = 0

    searchText = if @search_field.val() is @default_text then "" else $('<div/>').text($.trim(@search_field.val())).html()
    regexAnchor = if @search_contains then "" else "^"
    regex = new RegExp(regexAnchor + searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), 'i')
    zregex = new RegExp(searchText.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&"), 'i')

    for option in @results_data
      if not option.disabled and not option.empty
        if option.group
          $('#' + option.dom_id).css('display', 'none')
        else if not (@is_multiple and option.selected)
          found = false
          result_id = option.dom_id
          result = $("#" + result_id)

          if regex.test option.html
            found = true
            results += 1
          else if @enable_split_word_search and (option.html.indexOf(" ") >= 0 or option.html.indexOf("[") == 0)
            #TODO: replace this substitution of /\[\]/ with a list of characters to skip.
            parts = option.html.replace(/\[|\]/g, "").split(" ")
            if parts.length
              for part in parts
                if regex.test part
                  found = true
                  results += 1

          if found
            if searchText.length
              startpos = option.html.search zregex
              text = option.html.substr(0, startpos + searchText.length) + '</em>' + option.html.substr(startpos + searchText.length)
              text = text.substr(0, startpos) + '<em>' + text.substr(startpos)
            else
              text = option.html

            result.html(text)
            this.result_activate result

            $("#" + @results_data[option.group_array_index].dom_id).css('display', 'list-item') if option.group_array_index?
          else
            this.result_clear_highlight() if @result_highlight and result_id is @result_highlight.attr 'id'
            this.result_deactivate result

    if results < 1 and searchText.length
      this.no_results searchText
    else
      this.winnow_results_set_highlight()

  winnow_results_clear: ->
    @search_field.val ""
    lis = @search_results.find("li")

    for li in lis
      li = $(li)
      if li.hasClass "group-result"
        li.css('display', 'auto')
      else if not @is_multiple or not li.hasClass "result-selected"
        this.result_activate li

  winnow_results_set_highlight: ->
    if not @result_highlight

      selected_results = if not @is_multiple then @search_results.find(".result-selected.active-result") else []
      do_high = if selected_results.length then selected_results.first() else @search_results.find(".active-result").first()

      this.result_do_highlight do_high if do_high?

  no_results: (terms) ->
    no_results_html = $('<li class="no-results">' + @results_none_found + ' "<span></span>"</li>')
    no_results_html.find("span").first().html(terms)

    @search_results.append no_results_html

  no_results_clear: ->
    @search_results.find(".no-results").remove()

  keydown_arrow: ->
    if not @result_highlight
      first_active = @search_results.find("li.active-result").first()
      this.result_do_highlight $(first_active) if first_active
    else if @results_showing
      next_sib = @result_highlight.nextAll("li.active-result").first()
      this.result_do_highlight next_sib if next_sib
    this.results_show() if not @results_showing

  keyup_arrow: ->
    if not @results_showing and not @is_multiple
      this.results_show()
    else if @result_highlight
      prev_sibs = @result_highlight.prevAll("li.active-result")

      if prev_sibs.length
        this.result_do_highlight prev_sibs.first()
      else
        this.results_hide() if @choices > 0
        this.result_clear_highlight()

  keydown_backstroke: ->
    if @pending_backstroke
      this.choice_destroy @pending_backstroke.find("a").first()
      this.clear_backstroke()
    else
      next_available_destroy = @search_container.siblings("li.search-choice").last()
      if next_available_destroy.length and not next_available_destroy.hasClass("search-choice-disabled")
        @pending_backstroke = next_available_destroy
        if @single_backstroke_delete
          @keydown_backstroke()
        else
          @pending_backstroke.addClass "search-choice-focus"

  clear_backstroke: ->
    @pending_backstroke.removeClass "search-choice-focus" if @pending_backstroke
    @pending_backstroke = null

  keydown_checker: (evt) ->
    stroke = evt.which ? evt.keyCode
    this.search_field_scale()

    this.clear_backstroke() if stroke != 8 and this.pending_backstroke

    switch stroke
      when 8
        @backstroke_length = this.search_field.val().length
        break
      when 9
        this.result_select(evt) if this.results_showing and not @is_multiple
        @mouse_on_container = false
        break
      when 13
        evt.preventDefault()
        break
      when 38
        evt.preventDefault()
        this.keyup_arrow()
        break
      when 40
        this.keydown_arrow()
        break

  search_field_scale: ->
    if @is_multiple
      h = 0
      w = 0

      style_block = "position:absolute; left: -1000px; top: -1000px; display:none;"
      styles = ['font-size','font-style', 'font-weight', 'font-family','line-height', 'text-transform', 'letter-spacing']

      for style in styles
        style_block += style + ":" + @search_field.css(style) + ";"

      div = $('<div />', { 'style' : style_block })
      div.text @search_field.val()
      $('body').append div

      w = div.width() + 25
      div.remove()

      if( w > @f_width-10 )
        w = @f_width - 10

      @search_field.css({'width': w + 'px'})

      dd_top = @container.height()
      @dropdown.css({"top":  dd_top + "px"})

  generate_random_id: ->
    string = "sel" + this.generate_random_char() + this.generate_random_char() + this.generate_random_char()
    while $("#" + string).length > 0
      string += this.generate_random_char()
    string

root.Chosen = Chosen

get_side_border_padding = (elmt) ->
  side_border_padding = elmt.outerWidth() - elmt.width()

root.get_side_border_padding = get_side_border_padding
